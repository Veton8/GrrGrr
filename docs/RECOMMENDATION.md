# Recommendation Algorithm

## Overview

Grgr uses a **multi-signal recommendation engine** to power the "For You" feed. The system combines engagement tracking, hashtag interest profiling, and time-decayed scoring to surface the most relevant and engaging content to each user.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER WATCHES VIDEO                                                  │
│  → Frontend tracks watch duration (start/stop/pause timer)           │
│  → On video exit: POST /api/feed/:videoId/view                       │
│    { watchDurationMs, source: 'fyp'|'following'|'profile' }         │
├──────────────────────────────────────────────────────────────────────┤
│  ENGAGEMENT TRACKER (engagementTracker.js)                           │
│  → Debounce: 1 view per user per video per 30 seconds               │
│  → Compute completion_rate = watchDuration / videoDuration (cap 1.0) │
│  → Detect replay (watchDuration > videoDuration)                     │
│  → Store in video_views table                                        │
│  → Update user_interests: bump score for each hashtag on the video   │
├──────────────────────────────────────────────────────────────────────┤
│  SCORING JOB (every 15 minutes)                                      │
│  → Recompute video_scores for all videos posted in last 7 days       │
│  → Recompute hashtag trending_scores                                 │
├──────────────────────────────────────────────────────────────────────┤
│  FOR YOU FEED REQUEST                                                │
│  → GET /api/feed/foryou?page=1&limit=10&exclude=id1,id2             │
│  → 3 candidate pools → merge → shuffle → return                     │
└──────────────────────────────────────────────────────────────────────┘
```

## Scoring Formula

Each video receives a score computed as:

```
raw_score = (avg_completion_rate × 3.0)
          + (replay_count × 2.5)
          + (share_count × 2.0)
          + (comment_count × 1.5)
          + (like_count × 1.0)

time_decay = 1 / (1 + hours_since_posted / 24) ^ 1.5

final_score = raw_score × time_decay
```

### Weight Rationale

| Signal | Weight | Why |
|--------|--------|-----|
| Completion Rate | 3.0 | Strongest quality signal — users watch good content to the end |
| Replays | 2.5 | Re-watching indicates highly engaging content |
| Shares | 2.0 | Sharing is a strong intentional endorsement |
| Comments | 1.5 | Comments show engagement but can include negative sentiment |
| Likes | 1.0 | Lowest-effort interaction, easiest to inflate |

### Time Decay

The time decay function uses a **power-law decay** with a 24-hour half-life:

- **0 hours**: decay = 1.0 (full score)
- **24 hours**: decay ≈ 0.35
- **48 hours**: decay ≈ 0.19
- **72 hours**: decay ≈ 0.13
- **7 days**: decay ≈ 0.03

This ensures fresh content is strongly prioritized while viral older content can still surface.

## Candidate Pools

The For You feed draws from three pools, mixed together:

### 1. Interest-Based (50%)
- Queries `user_interests` table for user's top 20 hashtag affinities
- Finds videos tagged with those hashtags
- Sorted by `video_scores.score`
- **Personalization driver** — this is what makes the feed feel "tailored"

### 2. Trending (30%)
- Top-scored videos globally from `video_scores`
- No hashtag matching required — purely score-based
- Videos from the last 7 days
- **Discovery of popular content** regardless of user interests

### 3. Explore (20%)
- Random selection from videos posted in the last 48 hours
- Uses `ORDER BY RANDOM()` for true randomness
- **New creator discovery** — gives fresh content a chance even without engagement

### Filtering
All pools exclude:
- Videos the user has already watched (`video_views` table)
- Videos the user posted themselves
- Videos from previous pages (via `exclude` query parameter)

### Shuffle
After selecting from each pool, results are shuffled so the feed doesn't feel segmented (e.g., 5 interest videos then 3 trending then 2 random). The mix feels natural.

## Tuning the Algorithm

All weights are defined as constants in `recommendationEngine.js`:

```javascript
const WEIGHTS = {
  COMPLETION_RATE: 3.0,   // Increase to favor videos watched to completion
  REPLAY: 2.5,            // Increase to favor videos that get replayed
  SHARE: 2.0,             // Increase to favor shared content
  COMMENT: 1.5,           // Increase to favor discussed content
  LIKE: 1.0,              // Increase to favor liked content
  TIME_DECAY_POWER: 1.5,  // Increase for faster decay (more recency bias)
  TIME_DECAY_HALF_LIFE_HOURS: 24,  // Decrease for faster decay
};

const POOL_RATIOS = {
  INTEREST: 0.5,  // Personalization strength
  TRENDING: 0.3,  // Popular content exposure
  EXPLORE: 0.2,   // New creator discovery
};
```

## Engagement Data Model

### video_views
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | UUID |
| user_id | TEXT (FK) | Who watched |
| video_id | TEXT (FK) | What was watched |
| watch_duration_ms | INTEGER | Total milliseconds watched |
| video_duration_ms | INTEGER | Video's full duration in ms |
| completion_rate | REAL | watch_duration / video_duration (capped at 1.0) |
| source | TEXT | Where the view came from: fyp, following, profile, search, share |
| replayed | INTEGER | 1 if user watched past the video's end |
| created_at | TEXT | Timestamp |

### user_interests
| Column | Type | Description |
|--------|------|-------------|
| user_id | TEXT (PK) | User |
| hashtag | TEXT (PK) | Lowercase hashtag name |
| engagement_score | REAL | Cumulative score (incremented by completion_rate per view) |
| updated_at | TEXT | Last update time |

### hashtags
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | UUID |
| name | TEXT (UNIQUE) | Lowercase hashtag name |
| video_count | INTEGER | Number of videos using this hashtag |
| total_engagement | REAL | Sum of video scores for trending calculation |
| trending_score | REAL | Time-decayed engagement score (recomputed every 15 min) |
| updated_at | TEXT | Last recomputation time |

### video_hashtags
| Column | Type | Description |
|--------|------|-------------|
| video_id | TEXT (PK) | Video |
| hashtag_id | TEXT (PK) | Hashtag |

### video_scores
| Column | Type | Description |
|--------|------|-------------|
| video_id | TEXT (PK) | Video |
| score | REAL | Precomputed recommendation score |
| computed_at | TEXT | When the score was last computed |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/feed/foryou` | Optional | Personalized For You feed |
| GET | `/api/feed/following` | Required | Videos from followed users |
| POST | `/api/feed/:videoId/view` | Required | Record a video view event |
| GET | `/api/feed/hashtags/trending` | No | Top 20 trending hashtags |
| GET | `/api/feed/hashtags/:name/videos` | Optional | Videos for a hashtag |

### GET /api/feed/foryou

Query params:
- `page` (default: 1) — Page number
- `limit` (default: 10) — Videos per page
- `exclude` — Comma-separated video IDs to exclude (for cursor-based dedup)

Response:
```json
{
  "videos": [{ "id": "...", "videoUrl": "...", "user": {...}, ... }],
  "page": 1,
  "hasMore": true
}
```

### POST /api/feed/:videoId/view

Body:
```json
{
  "watchDurationMs": 15000,
  "source": "fyp"
}
```

Response:
```json
{
  "recorded": true,
  "completionRate": 0.75
}
```

Views under 1 second are rejected (accidental scrolls). Duplicate views within 30 seconds are debounced.

## Frontend Watch Time Tracking

The `VideoCard` component tracks watch time with a timer system:

1. When `isActive` becomes `true` → start timer (`Date.now()`)
2. When user pauses → save elapsed time, stop timer
3. When user unpauses → restart timer
4. When `isActive` becomes `false` (scrolled away) → accumulate remaining time, send view event
5. On unmount → flush accumulated time

```
isActive=true → timer starts
                 ↓ (user watches for 5s)
isPaused=true → save 5s, pause timer
                 ↓ (user unpauses after 2s)
isPaused=false → restart timer
                 ↓ (user watches for 8s more)
isActive=false → save 8s, total = 13s
                 → POST /feed/:id/view { watchDurationMs: 13000, source: 'fyp' }
```

## Scaling Considerations

The current implementation uses SQLite and in-process computation. This works well for up to ~50K users and ~500K videos. Beyond that:

- **Video Scores**: Move to Redis sorted sets (`ZADD video_scores <score> <videoId>`) for O(log N) retrieval
- **User Interests**: Consider a dedicated vector store or Redis hash maps
- **Scoring Job**: Move to a separate worker process or use BullMQ job scheduling
- **Collaborative Filtering**: Add a Python microservice using scikit-learn or TensorFlow for user-user and item-item collaborative filtering
- **Real-time Scoring**: Use Redis Streams or Kafka for real-time score updates on engagement events
- **A/B Testing**: Add experiment framework to test different weight configurations
- **Content Diversity**: Add diversity constraints (max N videos from same creator, min genre spread)
