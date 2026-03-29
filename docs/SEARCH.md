# Search & Discovery

## Overview

Grgr uses **SQLite FTS5** (Full-Text Search 5) for fast, ranked search across videos, users, and hashtags. The system includes autocomplete suggestions, a curated Discover page, and a hashtag detail page — all with rate limiting and input sanitization.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER TYPES IN SEARCH BAR                                           │
│  → Debounced input triggers GET /api/search/suggestions?q=...       │
│  → Autocomplete dropdown: hashtags (#dance) and users (@dancequeen) │
│  → On submit: GET /api/search?q=...&type=all                       │
├──────────────────────────────────────────────────────────────────────┤
│  SEARCH SERVICE (searchService.js)                                   │
│  → Input sanitization: strips FTS5 special chars [*"():^+-{}[\]\\]  │
│  → Rate limiting: 10 searches/minute per user (in-memory)           │
│  → FTS5 MATCH with BM25 ranking (prefix matching with *)           │
│  → LIKE fallback if FTS5 query fails                                │
│  → Suggestion caching: 5-minute TTL in-memory Map                   │
├──────────────────────────────────────────────────────────────────────┤
│  FTS5 VIRTUAL TABLES                                                 │
│  → videos_fts: video_id, caption, hashtags, username                │
│  → users_fts: user_id, username, display_name, bio                  │
│  → Standalone tables (not content-synced) — manual sync on write    │
├──────────────────────────────────────────────────────────────────────┤
│  DISCOVER PAGE                                                       │
│  → GET /api/search/discover                                          │
│  → Trending hashtags, popular creators, rising videos               │
│  → Rising = score / hours_since_posted (rewards recent + popular)   │
└──────────────────────────────────────────────────────────────────────┘
```

## FTS5 Implementation

### Why Standalone Tables?

SQLite FTS5 `content_rowid` requires INTEGER primary keys, but Grgr uses TEXT UUIDs. Instead of content-synced tables, we use standalone FTS5 tables with manual sync:

```sql
-- FTS5 virtual tables (no content= param)
CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
  video_id UNINDEXED, caption, hashtags, username
);
CREATE VIRTUAL TABLE IF NOT EXISTS users_fts USING fts5(
  user_id UNINDEXED, username, display_name, bio
);
```

### Sync Strategy

- **On video upload**: `syncVideoToFTS(videoId)` inserts caption + hashtags + username
- **On profile update**: `syncUserToFTS(userId)` inserts username + display_name + bio
- **On migration**: `rebuildSearchIndex()` bulk-inserts all existing videos and users
- Sync is delete-then-insert (idempotent)

### Search Ranking

FTS5's `bm25()` function provides TF-IDF-style relevance ranking. Queries use prefix matching (`dance*`) so partial words still match.

If an FTS5 query fails (malformed input that slipped through sanitization), the search falls back to `LIKE %query%` sorted by like count.

## Search Query Sanitization

```javascript
function sanitizeQuery(query) {
  // Remove FTS5 special characters to prevent syntax errors
  return query.replace(/[*"():^+\-{}[\]\\]/g, ' ').replace(/\s+/g, ' ').trim();
}
```

FTS5 special operators (`*`, `"`, `()`, `^`, `+`, `-`) are stripped to prevent injection of complex FTS queries. The sanitized string is then split into words with `*` appended for prefix matching.

## Rate Limiting

In-memory sliding window rate limiter:
- **10 searches per minute** per user (authenticated) or per IP (anonymous)
- Returns HTTP 429 with `"Too many searches. Please wait a moment."`
- Rate limit map entries are cleaned up every 60 seconds

## Suggestion Cache

Autocomplete suggestions are cached in an in-memory Map:
- **TTL**: 5 minutes
- **Key**: lowercase sanitized query
- **Cache hit**: returns immediately without DB query
- **Minimum query length**: 2 characters
- Returns up to 3 hashtags + 3 users (max 5 total)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/search` | Optional | Full-text search |
| GET | `/api/search/suggestions` | Optional | Autocomplete suggestions |
| GET | `/api/search/discover` | Optional | Discover page data |

### GET /api/search

Query params:
- `q` (required) — Search query
- `type` (default: `all`) — `all`, `videos`, `users`, or `hashtags`
- `page` (default: 1) — Page number
- `limit` (default: 10) — Results per page

Response:
```json
{
  "videos": [
    {
      "id": "...",
      "videoUrl": "...",
      "thumbnailUrl": "...",
      "caption": "New choreo! #dance #tutorial",
      "duration": 38,
      "viewCount": 52400,
      "likeCount": 28900,
      "commentCount": 1320,
      "createdAt": "2026-03-23T...",
      "user": {
        "id": "...",
        "username": "dancequeen",
        "displayName": "Dance Queen",
        "avatarUrl": "...",
        "isVerified": false
      }
    }
  ],
  "users": [
    {
      "id": "...",
      "username": "dancequeen",
      "displayName": "Dance Queen",
      "avatarUrl": "...",
      "bio": "Professional dancer",
      "isVerified": false,
      "followerCount": 5,
      "isFollowing": false
    }
  ],
  "hashtags": [
    { "id": "...", "name": "dance", "videoCount": 2, "trendingScore": 0 }
  ]
}
```

### GET /api/search/suggestions

Query params:
- `q` (required, min 2 chars) — Partial query

Response:
```json
[
  { "type": "hashtag", "text": "#dance", "id": "dance", "videoCount": 2 },
  { "type": "user", "text": "@dancequeen", "id": "uuid", "displayName": "Dance Queen", "avatarUrl": "..." }
]
```

### GET /api/search/discover

No query params required.

Response:
```json
{
  "trendingHashtags": [
    { "id": "...", "name": "viral", "videoCount": 3, "trendingScore": 0 }
  ],
  "popularCreators": [
    {
      "id": "...",
      "username": "dancequeen",
      "displayName": "Dance Queen",
      "avatarUrl": "...",
      "isVerified": false,
      "bio": "Professional dancer",
      "followerCount": 5
    }
  ],
  "risingVideos": [
    {
      "id": "...",
      "videoUrl": "...",
      "thumbnailUrl": "...",
      "caption": "...",
      "viewCount": 102000,
      "likeCount": 58302,
      "user": { "id": "...", "username": "comedyking", "displayName": "Comedy King" }
    }
  ]
}
```

## Discover Page Sections

### Trending Hashtags
- Top 10 hashtags by `trending_score` (recomputed every 15 min by recommendation engine)
- Falls back to `video_count` when trending scores are equal
- Displayed as tappable chips on the Discover screen

### Popular Creators
- Top 10 users by follower count
- Includes avatar, display name, bio, follower count
- Displayed as horizontal scrollable cards

### Rising Videos
- Top 10 videos ranked by `score / hours_since_posted`
- Rewards videos that are both popular AND recent
- Displayed as a 3-column thumbnail grid

## Frontend

### DiscoverScreen
- **Default mode**: Discover page with trending hashtags, popular creators, rising videos
- **Search mode**: Activated when search bar is focused
  - Shows search history (persisted in AsyncStorage)
  - Shows autocomplete suggestions while typing (debounced 300ms)
  - On submit: shows tabbed results (All, Videos, Users, Hashtags)
- Search history: stores last 10 searches, clearable

### HashtagScreen
- Accessed by tapping a hashtag chip or hashtag in search results
- Shows hashtag name, video count, and total views
- Displays videos in a 3-column grid with pagination
- Pull-to-refresh support

## Data Model

### videos_fts (FTS5 virtual table)
| Column | Indexed | Description |
|--------|---------|-------------|
| video_id | No (UNINDEXED) | Video UUID for joining back to videos table |
| caption | Yes | Video caption text |
| hashtags | Yes | Space-separated hashtag names |
| username | Yes | Uploader's username |

### users_fts (FTS5 virtual table)
| Column | Indexed | Description |
|--------|---------|-------------|
| user_id | No (UNINDEXED) | User UUID for joining back to users table |
| username | Yes | Username |
| display_name | Yes | Display name |
| bio | Yes | User bio |

## Scaling Considerations

The current implementation works well for up to ~100K videos and ~50K users. Beyond that:

- **FTS Index Size**: FTS5 tables grow with content. Consider periodic `OPTIMIZE` commands
- **Rate Limiting**: Move from in-memory to Redis-backed rate limiting for multi-process deployments
- **Suggestion Cache**: Move to Redis for shared cache across processes
- **Elasticsearch**: For larger datasets, consider migrating to Elasticsearch for more sophisticated ranking (fuzzy matching, boosting, synonyms)
- **Search Analytics**: Track search queries to improve relevance and identify content gaps
- **Typo Tolerance**: FTS5 doesn't support fuzzy matching — consider adding a trigram index or Levenshtein distance layer
