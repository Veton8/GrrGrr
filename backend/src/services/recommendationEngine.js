/**
 * Recommendation Engine
 * Computes video scores, generates personalized For You feeds,
 * and manages trending hashtag calculations.
 *
 * ## Scoring Formula
 * ```
 * raw_score = (avg_completion_rate * 3.0) + (replay_count * 2.5) +
 *             (share_count * 2.0) + (comment_count * 1.5) + (like_count * 1.0)
 * time_decay = 1 / (1 + hours_since_posted / 24) ^ 1.5
 * final_score = raw_score * time_decay
 * ```
 *
 * ## Candidate Pools
 * - 50% Interest-based: videos matching user's top hashtag interests
 * - 30% Trending: globally top-scored videos
 * - 20% Explore: random recent videos for discovery
 *
 * ## Scaling Note
 * At 50K+ users, consider moving scoring to Redis sorted sets and
 * adding a Python microservice for collaborative filtering.
 */
const { sqlite } = require('../config/database');

/** Scoring weight constants -- tune these to adjust the algorithm */
const WEIGHTS = {
  COMPLETION_RATE: 3.0,
  REPLAY: 2.5,
  SHARE: 2.0,
  COMMENT: 1.5,
  LIKE: 1.0,
  TIME_DECAY_POWER: 1.5,
  TIME_DECAY_HALF_LIFE_HOURS: 24,
};

/** Pool ratios for For You feed candidate selection */
const POOL_RATIOS = {
  INTEREST: 0.5,
  TRENDING: 0.3,
  EXPLORE: 0.2,
};

/**
 * Compute a score for a single video.
 * @param {string} videoId
 * @returns {number} The computed score
 */
function scoreVideo(videoId) {
  const video = sqlite.prepare(
    'SELECT like_count, comment_count, share_count, created_at FROM videos WHERE id = ?'
  ).get(videoId);
  if (!video) return 0;

  // Get engagement stats from video_views
  const viewStats = sqlite.prepare(
    `SELECT
       AVG(completion_rate) as avg_completion,
       SUM(replayed) as replay_count,
       COUNT(*) as view_count
     FROM video_views WHERE video_id = ?`
  ).get(videoId);

  const avgCompletion = viewStats?.avg_completion || 0;
  const replayCount = viewStats?.replay_count || 0;

  // Compute raw score
  const rawScore =
    (avgCompletion * WEIGHTS.COMPLETION_RATE) +
    (replayCount * WEIGHTS.REPLAY) +
    (video.share_count * WEIGHTS.SHARE) +
    (video.comment_count * WEIGHTS.COMMENT) +
    (video.like_count * WEIGHTS.LIKE);

  // Compute time decay
  const createdAt = new Date(video.created_at + 'Z');
  const hoursSincePosted = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const timeDecay = 1 / Math.pow(1 + hoursSincePosted / WEIGHTS.TIME_DECAY_HALF_LIFE_HOURS, WEIGHTS.TIME_DECAY_POWER);

  return rawScore * timeDecay;
}

/**
 * Recompute scores for all videos posted in the last 7 days.
 * Stores results in the video_scores table.
 */
function recomputeAllScores() {
  const videos = sqlite.prepare(
    `SELECT id FROM videos WHERE created_at > datetime('now', '-7 days')`
  ).all();

  const upsert = sqlite.prepare(
    `INSERT INTO video_scores (video_id, score, computed_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(video_id) DO UPDATE SET score = excluded.score, computed_at = datetime('now')`
  );

  const tx = sqlite.transaction(() => {
    for (const { id } of videos) {
      const score = scoreVideo(id);
      upsert.run(id, score);
    }
  });
  tx();

  // Also recompute hashtag trending scores
  recomputeHashtagTrending();

  console.log(`[RecommendationEngine] Recomputed scores for ${videos.length} videos`);
}

/**
 * Recompute trending scores for all hashtags.
 * Trending score = sum of engagement on videos with that hashtag in the last 24 hours,
 * weighted by time decay.
 */
function recomputeHashtagTrending() {
  const hashtags = sqlite.prepare('SELECT id, name FROM hashtags').all();

  const update = sqlite.prepare(
    `UPDATE hashtags SET trending_score = ?, total_engagement = ?, video_count = ?, updated_at = datetime('now') WHERE id = ?`
  );

  const tx = sqlite.transaction(() => {
    for (const { id, name } of hashtags) {
      // Get all videos with this hashtag from last 24 hours
      const stats = sqlite.prepare(
        `SELECT COALESCE(SUM(vs.score), 0) as total_score, COUNT(DISTINCT vh.video_id) as count
         FROM video_hashtags vh
         JOIN videos v ON vh.video_id = v.id
         LEFT JOIN video_scores vs ON vh.video_id = vs.video_id
         WHERE vh.hashtag_id = ? AND v.created_at > datetime('now', '-24 hours')`
      ).get(id);

      const totalCount = sqlite.prepare(
        `SELECT COUNT(*) as c FROM video_hashtags WHERE hashtag_id = ?`
      ).get(id);

      update.run(stats.total_score || 0, stats.total_score || 0, totalCount.c || 0, id);
    }
  });
  tx();
}

/**
 * Generate a personalized For You feed for a user.
 *
 * @param {string} userId - The user requesting the feed
 * @param {number} limit - Number of videos to return
 * @param {string[]} excludeIds - Video IDs to exclude (already seen in previous pages)
 * @returns {string[]} Array of video IDs in recommended order
 */
function getForYouCandidates(userId, limit = 10, excludeIds = []) {
  const interestCount = Math.ceil(limit * POOL_RATIOS.INTEREST);
  const trendingCount = Math.ceil(limit * POOL_RATIOS.TRENDING);
  const exploreCount = limit - interestCount - trendingCount;

  // Build exclude clause — only exclude explicitly passed IDs (previous pages)
  // Don't exclude watched videos — users can re-see content like TikTok
  const excludeSet = new Set(excludeIds);
  const placeholders = excludeSet.size > 0
    ? `AND v.id NOT IN (${[...excludeSet].map(() => '?').join(',')})`
    : '';
  const excludeArr = [...excludeSet];

  // -- POOL 1: Interest-based (50%) --
  // Get user's top interests
  const interests = sqlite.prepare(
    `SELECT hashtag FROM user_interests WHERE user_id = ? ORDER BY engagement_score DESC LIMIT 20`
  ).all(userId);

  let interestVideos = [];
  if (interests.length > 0) {
    const tagNames = interests.map(i => i.hashtag);
    const tagPlaceholders = tagNames.map(() => '?').join(',');
    interestVideos = sqlite.prepare(
      `SELECT DISTINCT v.id, COALESCE(vs.score, 0) as score
       FROM videos v
       JOIN video_hashtags vh ON v.id = vh.video_id
       JOIN hashtags h ON vh.hashtag_id = h.id
       LEFT JOIN video_scores vs ON v.id = vs.video_id
       WHERE h.name IN (${tagPlaceholders})
       ${placeholders}
       ORDER BY vs.score DESC
       LIMIT ?`
    ).all(...tagNames, ...excludeArr, interestCount * 3); // fetch extra for diversity
  }

  // -- POOL 2: Trending (30%) --
  const trendingVideos = sqlite.prepare(
    `SELECT v.id, vs.score
     FROM videos v
     JOIN video_scores vs ON v.id = vs.video_id
     WHERE v.created_at > datetime('now', '-7 days')
     ${placeholders}
     ORDER BY vs.score DESC
     LIMIT ?`
  ).all(...excludeArr, trendingCount * 3);

  // -- POOL 3: Explore / random recent (20%) --
  const exploreVideos = sqlite.prepare(
    `SELECT v.id, RANDOM() as score
     FROM videos v
     WHERE v.created_at > datetime('now', '-30 days')
     ${placeholders}
     ORDER BY RANDOM()
     LIMIT ?`
  ).all(...excludeArr, exploreCount * 3);

  // Deduplicate and select
  const selectedIds = new Set();
  const result = [];

  // Pick from each pool
  const startLen = result.length;
  for (const item of interestVideos) {
    if (selectedIds.has(item.id)) continue;
    selectedIds.add(item.id);
    result.push(item.id);
    if (result.length - startLen >= interestCount) break;
  }

  const startLen2 = result.length;
  for (const item of trendingVideos) {
    if (selectedIds.has(item.id)) continue;
    selectedIds.add(item.id);
    result.push(item.id);
    if (result.length - startLen2 >= trendingCount) break;
  }

  const startLen3 = result.length;
  for (const item of exploreVideos) {
    if (selectedIds.has(item.id)) continue;
    selectedIds.add(item.id);
    result.push(item.id);
    if (result.length - startLen3 >= exploreCount) break;
  }

  // If we don't have enough, fill with any recent scored videos
  if (result.length < limit) {
    const filler = sqlite.prepare(
      `SELECT v.id FROM videos v
       LEFT JOIN video_scores vs ON v.id = vs.video_id
       WHERE 1=1 ${placeholders}
       ORDER BY COALESCE(vs.score, 0) DESC, v.created_at DESC
       LIMIT ?`
    ).all(...excludeArr, limit - result.length + 10);

    for (const item of filler) {
      if (selectedIds.has(item.id)) continue;
      selectedIds.add(item.id);
      result.push(item.id);
      if (result.length >= limit) break;
    }
  }

  // Shuffle to avoid segmented feel
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.slice(0, limit);
}

/**
 * Get trending hashtags.
 * @param {number} limit
 * @returns {Array<{id: string, name: string, videoCount: number, trendingScore: number}>}
 */
function getTrendingHashtags(limit = 20) {
  return sqlite.prepare(
    `SELECT id, name, video_count as videoCount, trending_score as trendingScore, total_engagement as totalEngagement
     FROM hashtags
     ORDER BY trending_score DESC, video_count DESC
     LIMIT ?`
  ).all(limit);
}

/**
 * Get video IDs for a specific hashtag, sorted by score.
 * @param {string} hashtagName
 * @param {number} limit
 * @param {number} offset
 * @returns {string[]}
 */
function getVideosByHashtag(hashtagName, limit = 10, offset = 0) {
  return sqlite.prepare(
    `SELECT v.id
     FROM videos v
     JOIN video_hashtags vh ON v.id = vh.video_id
     JOIN hashtags h ON vh.hashtag_id = h.id
     LEFT JOIN video_scores vs ON v.id = vs.video_id
     WHERE h.name = ?
     ORDER BY COALESCE(vs.score, 0) DESC
     LIMIT ? OFFSET ?`
  ).all(hashtagName.toLowerCase(), limit, offset).map(r => r.id);
}

// Start the scoring job (runs every 15 minutes)
let scoringInterval = null;

function startScoringJob() {
  // Run immediately on startup
  try {
    recomputeAllScores();
  } catch (err) {
    console.error('[RecommendationEngine] Initial scoring failed:', err.message);
  }

  // Then every 15 minutes
  scoringInterval = setInterval(() => {
    try {
      recomputeAllScores();
    } catch (err) {
      console.error('[RecommendationEngine] Scoring job failed:', err.message);
    }
  }, 15 * 60 * 1000);
}

function stopScoringJob() {
  if (scoringInterval) {
    clearInterval(scoringInterval);
    scoringInterval = null;
  }
}

module.exports = {
  WEIGHTS,
  POOL_RATIOS,
  scoreVideo,
  recomputeAllScores,
  recomputeHashtagTrending,
  getForYouCandidates,
  getTrendingHashtags,
  getVideosByHashtag,
  startScoringJob,
  stopScoringJob,
};
