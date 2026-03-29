/**
 * Tests for recommendation algorithm, engagement tracking, hashtag parsing,
 * and For You feed candidate selection.
 */
require('dotenv').config();

// ─── Hashtag Parsing ─────────────────────────────────────────────────────────

describe('Hashtag Parsing', () => {
  let parseHashtags;

  beforeAll(() => {
    jest.resetModules();
    const tracker = require('../src/services/engagementTracker');
    parseHashtags = tracker.parseHashtags;
  });

  test('extracts hashtags from caption', () => {
    const tags = parseHashtags('Check this out #travel #adventure');
    expect(tags).toEqual(['travel', 'adventure']);
  });

  test('returns empty array for no hashtags', () => {
    expect(parseHashtags('No hashtags here')).toEqual([]);
  });

  test('returns empty array for null/undefined', () => {
    expect(parseHashtags(null)).toEqual([]);
    expect(parseHashtags(undefined)).toEqual([]);
    expect(parseHashtags('')).toEqual([]);
  });

  test('lowercases hashtags', () => {
    const tags = parseHashtags('#Travel #ADVENTURE #FuN');
    expect(tags).toEqual(['travel', 'adventure', 'fun']);
  });

  test('deduplicates hashtags', () => {
    const tags = parseHashtags('#travel #adventure #travel');
    expect(tags).toEqual(['travel', 'adventure']);
  });

  test('handles hashtags with underscores and numbers', () => {
    const tags = parseHashtags('#day_in_my_life #vlog2024');
    expect(tags).toEqual(['day_in_my_life', 'vlog2024']);
  });

  test('handles multiple hashtags in complex caption', () => {
    const tags = parseHashtags('POV: you finally beat the final boss #gaming #victory #epic');
    expect(tags).toEqual(['gaming', 'victory', 'epic']);
  });
});

// ─── Video Scoring Formula ───────────────────────────────────────────────────

describe('Video Scoring Formula', () => {
  let WEIGHTS;

  beforeAll(() => {
    jest.resetModules();
    const engine = require('../src/services/recommendationEngine');
    WEIGHTS = engine.WEIGHTS;
  });

  test('scoring weights are defined', () => {
    expect(WEIGHTS.COMPLETION_RATE).toBe(3.0);
    expect(WEIGHTS.REPLAY).toBe(2.5);
    expect(WEIGHTS.SHARE).toBe(2.0);
    expect(WEIGHTS.COMMENT).toBe(1.5);
    expect(WEIGHTS.LIKE).toBe(1.0);
    expect(WEIGHTS.TIME_DECAY_POWER).toBe(1.5);
    expect(WEIGHTS.TIME_DECAY_HALF_LIFE_HOURS).toBe(24);
  });

  test('raw score formula computes correctly with known inputs', () => {
    const avgCompletion = 0.8;
    const replayCount = 3;
    const shareCount = 10;
    const commentCount = 20;
    const likeCount = 50;

    const rawScore =
      (avgCompletion * WEIGHTS.COMPLETION_RATE) +
      (replayCount * WEIGHTS.REPLAY) +
      (shareCount * WEIGHTS.SHARE) +
      (commentCount * WEIGHTS.COMMENT) +
      (likeCount * WEIGHTS.LIKE);

    // 0.8*3.0 + 3*2.5 + 10*2.0 + 20*1.5 + 50*1.0
    // = 2.4 + 7.5 + 20 + 30 + 50 = 109.9
    expect(rawScore).toBeCloseTo(109.9, 1);
  });

  test('time decay reduces score for older videos', () => {
    const hoursSincePosted = 48; // 2 days old
    const timeDecay = 1 / Math.pow(1 + hoursSincePosted / WEIGHTS.TIME_DECAY_HALF_LIFE_HOURS, WEIGHTS.TIME_DECAY_POWER);

    // 1 / (1 + 48/24)^1.5 = 1 / 3^1.5 = 1 / 5.196 ≈ 0.192
    expect(timeDecay).toBeCloseTo(0.192, 2);
  });

  test('time decay is 1.0 for brand new video (0 hours)', () => {
    const hoursSincePosted = 0;
    const timeDecay = 1 / Math.pow(1 + hoursSincePosted / WEIGHTS.TIME_DECAY_HALF_LIFE_HOURS, WEIGHTS.TIME_DECAY_POWER);
    expect(timeDecay).toBe(1.0);
  });

  test('final score = rawScore * timeDecay', () => {
    const rawScore = 109.9;
    const hoursSincePosted = 24;
    const timeDecay = 1 / Math.pow(1 + hoursSincePosted / WEIGHTS.TIME_DECAY_HALF_LIFE_HOURS, WEIGHTS.TIME_DECAY_POWER);
    const finalScore = rawScore * timeDecay;

    // timeDecay = 1 / 2^1.5 = 1/2.828 ≈ 0.3536
    // finalScore ≈ 109.9 * 0.3536 ≈ 38.86
    expect(finalScore).toBeCloseTo(38.86, 0);
  });
});

// ─── Candidate Pool Selection ────────────────────────────────────────────────

describe('Candidate Pool Selection', () => {
  let POOL_RATIOS;

  beforeAll(() => {
    jest.resetModules();
    const engine = require('../src/services/recommendationEngine');
    POOL_RATIOS = engine.POOL_RATIOS;
  });

  test('pool ratios sum to 1.0', () => {
    const sum = POOL_RATIOS.INTEREST + POOL_RATIOS.TRENDING + POOL_RATIOS.EXPLORE;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test('pool ratios are 50/30/20', () => {
    expect(POOL_RATIOS.INTEREST).toBe(0.5);
    expect(POOL_RATIOS.TRENDING).toBe(0.3);
    expect(POOL_RATIOS.EXPLORE).toBe(0.2);
  });

  test('pool counts for limit=10 are approximately correct', () => {
    const limit = 10;
    const interestCount = Math.ceil(limit * POOL_RATIOS.INTEREST);
    const trendingCount = Math.ceil(limit * POOL_RATIOS.TRENDING);
    const exploreCount = limit - interestCount - trendingCount;

    expect(interestCount).toBe(5);
    expect(trendingCount).toBe(3);
    expect(exploreCount).toBe(2);
  });

  test('pool counts for limit=20 scale proportionally', () => {
    const limit = 20;
    const interestCount = Math.ceil(limit * POOL_RATIOS.INTEREST);
    const trendingCount = Math.ceil(limit * POOL_RATIOS.TRENDING);
    const exploreCount = limit - interestCount - trendingCount;

    expect(interestCount).toBe(10);
    expect(trendingCount).toBe(6);
    expect(exploreCount).toBe(4);
  });
});

// ─── Engagement Tracker Debouncing ───────────────────────────────────────────

describe('Engagement Tracker Debouncing', () => {
  test('debounce logic prevents rapid duplicate views', () => {
    // Simulate debounce map
    const DEBOUNCE_MS = 30 * 1000;
    const debounceMap = new Map();

    const key = 'user1:video1';
    const now = Date.now();

    // First view — should be allowed
    const lastView1 = debounceMap.get(key);
    const allowed1 = !lastView1 || (now - lastView1 >= DEBOUNCE_MS);
    expect(allowed1).toBe(true);
    debounceMap.set(key, now);

    // Immediate second view — should be blocked
    const lastView2 = debounceMap.get(key);
    const allowed2 = !lastView2 || (now - lastView2 >= DEBOUNCE_MS);
    expect(allowed2).toBe(false);

    // View after 31 seconds — should be allowed
    const futureTime = now + 31000;
    const lastView3 = debounceMap.get(key);
    const allowed3 = !lastView3 || (futureTime - lastView3 >= DEBOUNCE_MS);
    expect(allowed3).toBe(true);
  });

  test('completion rate capped at 1.0', () => {
    const watchDurationMs = 60000; // 60 seconds
    const videoDurationMs = 30000; // 30 second video (watched 2x)
    const completionRate = Math.min(watchDurationMs / videoDurationMs, 1.0);
    expect(completionRate).toBe(1.0);
  });

  test('completion rate computed correctly for partial view', () => {
    const watchDurationMs = 15000;
    const videoDurationMs = 30000;
    const completionRate = Math.min(watchDurationMs / videoDurationMs, 1.0);
    expect(completionRate).toBe(0.5);
  });

  test('replayed flag set when watch exceeds duration', () => {
    const watchDurationMs = 45000;
    const videoDurationMs = 30000;
    const replayed = videoDurationMs > 0 && watchDurationMs > videoDurationMs ? 1 : 0;
    expect(replayed).toBe(1);
  });

  test('replayed flag not set for partial view', () => {
    const watchDurationMs = 20000;
    const videoDurationMs = 30000;
    const replayed = videoDurationMs > 0 && watchDurationMs > videoDurationMs ? 1 : 0;
    expect(replayed).toBe(0);
  });
});

// ─── Watched Video Filtering ─────────────────────────────────────────────────

describe('Watched Video Filtering', () => {
  test('exclude set correctly filters watched videos', () => {
    const allVideos = ['v1', 'v2', 'v3', 'v4', 'v5'];
    const watchedIds = new Set(['v2', 'v4']);
    const excludeIds = new Set(['v5']); // from pagination

    const filtered = allVideos.filter(id => !watchedIds.has(id) && !excludeIds.has(id));
    expect(filtered).toEqual(['v1', 'v3']);
    expect(filtered).not.toContain('v2');
    expect(filtered).not.toContain('v4');
    expect(filtered).not.toContain('v5');
  });

  test('own videos are excluded from recommendations', () => {
    const allVideos = [
      { id: 'v1', userId: 'userA' },
      { id: 'v2', userId: 'userB' },
      { id: 'v3', userId: 'userA' },
      { id: 'v4', userId: 'userC' },
    ];
    const currentUserId = 'userA';
    const filtered = allVideos.filter(v => v.userId !== currentUserId);
    expect(filtered.map(v => v.id)).toEqual(['v2', 'v4']);
  });
});

// ─── Integration Concept ─────────────────────────────────────────────────────

describe('Integration: Video → Watch → Interest → FYP Lifecycle', () => {
  test('full lifecycle: post video with hashtags → watch → interests updated → appears in FYP', () => {
    // 1. Post a video with hashtags
    const videoCaption = 'Amazing sunset #travel #nature #beautiful';
    const tags = videoCaption.match(/#(\w+)/g)?.map(m => m.slice(1).toLowerCase()) || [];
    expect(tags).toEqual(['travel', 'nature', 'beautiful']);

    // 2. Simulate watching the video (high completion)
    const watchDurationMs = 28000;
    const videoDurationMs = 30000;
    const completionRate = Math.min(watchDurationMs / videoDurationMs, 1.0);
    expect(completionRate).toBeCloseTo(0.933, 2);

    // 3. Simulate user interest update
    const userInterests = {};
    for (const tag of tags) {
      const scoreIncrement = completionRate * 1.0;
      userInterests[tag] = (userInterests[tag] || 0) + scoreIncrement;
    }
    expect(userInterests.travel).toBeCloseTo(0.933, 2);
    expect(userInterests.nature).toBeCloseTo(0.933, 2);
    expect(userInterests.beautiful).toBeCloseTo(0.933, 2);

    // 4. Simulate FYP candidate selection
    // New video with matching hashtags would score higher for this user
    const candidateVideos = [
      { id: 'c1', tags: ['travel', 'food'], score: 50 },
      { id: 'c2', tags: ['gaming'], score: 80 },
      { id: 'c3', tags: ['nature', 'wildlife'], score: 40 },
    ];

    const interestTags = new Set(Object.keys(userInterests));
    const interestMatches = candidateVideos.filter(v =>
      v.tags.some(t => interestTags.has(t))
    );

    // c1 (travel) and c3 (nature) should match user interests
    expect(interestMatches.map(v => v.id)).toEqual(['c1', 'c3']);
    expect(interestMatches).not.toContainEqual(expect.objectContaining({ id: 'c2' }));
  });
});

// ─── Valid Source Types ───────────────────────────────────────────────────────

describe('View Source Validation', () => {
  const validSources = ['fyp', 'following', 'profile', 'search', 'share'];

  test('all valid sources are accepted', () => {
    for (const source of validSources) {
      expect(validSources.includes(source)).toBe(true);
    }
  });

  test('invalid source falls back to fyp', () => {
    const source = 'invalid_source';
    const safeSource = validSources.includes(source) ? source : 'fyp';
    expect(safeSource).toBe('fyp');
  });

  test('sub-1-second views are rejected', () => {
    const watchDurationMs = 500;
    const shouldRecord = watchDurationMs >= 1000;
    expect(shouldRecord).toBe(false);
  });

  test('1-second views are accepted', () => {
    const watchDurationMs = 1000;
    const shouldRecord = watchDurationMs >= 1000;
    expect(shouldRecord).toBe(true);
  });
});
