require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', '..', 'grgr.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT DEFAULT '',
    coin_balance INTEGER DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    is_live INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Followers table
  `CREATE TABLE IF NOT EXISTS followers (
    follower_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id)
  )`,

  // Videos table
  `CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT DEFAULT '',
    duration INTEGER NOT NULL,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Video likes
  `CREATE TABLE IF NOT EXISTS video_likes (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, video_id)
  )`,

  // Comments
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Livestreams
  `CREATE TABLE IF NOT EXISTS livestreams (
    id TEXT PRIMARY KEY,
    host_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT DEFAULT '',
    thumbnail_url TEXT,
    is_active INTEGER DEFAULT 1,
    viewer_count INTEGER DEFAULT 0,
    total_gifts_value INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT
  )`,

  // Gifts catalog
  `CREATE TABLE IF NOT EXISTS gifts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT NOT NULL,
    animation_url TEXT,
    coin_cost INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Gift transactions
  `CREATE TABLE IF NOT EXISTS gift_transactions (
    id TEXT PRIMARY KEY,
    sender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    gift_id TEXT REFERENCES gifts(id) ON DELETE CASCADE,
    livestream_id TEXT REFERENCES livestreams(id) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 1,
    total_coins INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Battles
  `CREATE TABLE IF NOT EXISTS battles (
    id TEXT PRIMARY KEY,
    livestream_id TEXT REFERENCES livestreams(id) ON DELETE CASCADE,
    creator_a_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    creator_b_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    creator_a_score INTEGER DEFAULT 0,
    creator_b_score INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 300,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    ended_at TEXT,
    winner_id TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Coin purchases
  `CREATE TABLE IF NOT EXISTS coin_purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    payment_provider TEXT,
    payment_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Refresh tokens
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gift_transactions_livestream ON gift_transactions(livestream_id)`,
  `CREATE INDEX IF NOT EXISTS idx_battles_livestream ON battles(livestream_id)`,
  `CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`,
];

// Columns to add to the videos table (safe ALTER — ignores if already exists)
const videoColumnMigrations = [
  "ALTER TABLE videos ADD COLUMN hls_url TEXT",
  "ALTER TABLE videos ADD COLUMN width INTEGER",
  "ALTER TABLE videos ADD COLUMN height INTEGER",
  "ALTER TABLE videos ADD COLUMN processing_status TEXT DEFAULT 'pending'",
  "ALTER TABLE videos ADD COLUMN processed_at TEXT",
];

// Content moderation tables
const moderationMigrations = [
  // User status column
  "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'",

  // Reports table
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    reviewer_id TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  )`,

  // User strikes table
  `CREATE TABLE IF NOT EXISTS user_strikes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    content_id TEXT,
    severity TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  )`,

  // Moderation audit log
  `CREATE TABLE IF NOT EXISTS moderation_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    user_id TEXT,
    content_id TEXT,
    details TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Indexes
  "CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id)",
  "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, priority)",
  "CREATE INDEX IF NOT EXISTS idx_strikes_user ON user_strikes(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_modlog_user ON moderation_log(user_id)",
];

// Push notification tables
const notificationMigrations = [
  // Push tokens
  `CREATE TABLE IF NOT EXISTS push_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT DEFAULT 'unknown',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, token)
  )`,

  // In-app notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Notification preferences
  `CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferences TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Indexes
  "CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)",
];

// Recommendation & engagement tracking tables
const recommendationMigrations = [
  // Video views / engagement tracking
  `CREATE TABLE IF NOT EXISTS video_views (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    watch_duration_ms INTEGER NOT NULL DEFAULT 0,
    video_duration_ms INTEGER NOT NULL DEFAULT 0,
    completion_rate REAL NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'fyp',
    replayed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // User interests (hashtag affinity)
  `CREATE TABLE IF NOT EXISTS user_interests (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hashtag TEXT NOT NULL,
    engagement_score REAL NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, hashtag)
  )`,

  // Hashtags
  `CREATE TABLE IF NOT EXISTS hashtags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    video_count INTEGER NOT NULL DEFAULT 0,
    total_engagement REAL NOT NULL DEFAULT 0,
    trending_score REAL NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Video-Hashtag junction
  `CREATE TABLE IF NOT EXISTS video_hashtags (
    video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    hashtag_id TEXT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, hashtag_id)
  )`,

  // Video scores (precomputed)
  `CREATE TABLE IF NOT EXISTS video_scores (
    video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
    score REAL NOT NULL DEFAULT 0,
    computed_at TEXT DEFAULT (datetime('now'))
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_video_views_user_video ON video_views(user_id, video_id)`,
  `CREATE INDEX IF NOT EXISTS idx_video_views_video ON video_views(video_id)`,
  `CREATE INDEX IF NOT EXISTS idx_video_views_created ON video_views(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id, engagement_score)`,
  `CREATE INDEX IF NOT EXISTS idx_hashtags_name ON hashtags(name)`,
  `CREATE INDEX IF NOT EXISTS idx_hashtags_trending ON hashtags(trending_score)`,
  `CREATE INDEX IF NOT EXISTS idx_video_hashtags_hashtag ON video_hashtags(hashtag_id)`,
  `CREATE INDEX IF NOT EXISTS idx_video_scores_score ON video_scores(score)`,
];

// FTS5 search tables (standalone — no content sync, manually managed)
const searchMigrations = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(video_id UNINDEXED, caption, hashtags, username)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS users_fts USING fts5(user_id UNINDEXED, username, display_name, bio)`,
];

// Direct messaging tables
const messagingMigrations = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'direct',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT DEFAULT (datetime('now')),
    last_read_at TEXT DEFAULT (datetime('now')),
    muted INTEGER DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT DEFAULT '',
    media_url TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,
];

/**
 * Rebuild the FTS5 search index from scratch.
 * Clears and repopulates videos_fts and users_fts.
 */
function rebuildSearchIndex(database) {
  try {
    // Clear existing FTS data
    database.exec(`DELETE FROM videos_fts`);
    database.exec(`DELETE FROM users_fts`);

    // Repopulate videos_fts
    const videos = database.prepare(
      `SELECT v.id, v.caption, u.username
       FROM videos v JOIN users u ON v.user_id = u.id`
    ).all();

    const insertVideoFts = database.prepare(
      `INSERT INTO videos_fts (video_id, caption, hashtags, username) VALUES (?, ?, ?, ?)`
    );

    const getVideoHashtags = database.prepare(
      `SELECT h.name FROM video_hashtags vh JOIN hashtags h ON vh.hashtag_id = h.id WHERE vh.video_id = ?`
    );

    const insertVideosFts = database.transaction(() => {
      for (const v of videos) {
        const tags = getVideoHashtags.all(v.id);
        const hashtagStr = tags.map(t => t.name).join(' ');
        insertVideoFts.run(v.id, v.caption || '', hashtagStr, v.username);
      }
    });
    insertVideosFts();

    // Repopulate users_fts
    const users = database.prepare(
      `SELECT id, username, display_name, bio FROM users`
    ).all();

    const insertUserFts = database.prepare(
      `INSERT INTO users_fts (user_id, username, display_name, bio) VALUES (?, ?, ?, ?)`
    );

    const insertUsersFts = database.transaction(() => {
      for (const u of users) {
        insertUserFts.run(u.id, u.username, u.display_name || '', u.bio || '');
      }
    });
    insertUsersFts();

    console.log(`Search index rebuilt: ${videos.length} videos, ${users.length} users`);
  } catch (err) {
    console.error('Failed to rebuild search index:', err.message);
  }
}

function migrate() {
  try {
    for (const sql of migrations) {
      db.exec(sql);
    }

    // Add new video columns (ignore "duplicate column" errors)
    for (const sql of videoColumnMigrations) {
      try { db.exec(sql); } catch (e) {
        if (!e.message.includes('duplicate column')) throw e;
      }
    }

    // Content moderation tables and columns
    for (const sql of moderationMigrations) {
      try { db.exec(sql); } catch (e) {
        if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) throw e;
      }
    }

    // Push notification tables
    for (const sql of notificationMigrations) {
      try { db.exec(sql); } catch (e) {
        if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) throw e;
      }
    }

    // Recommendation & engagement tracking tables
    for (const sql of recommendationMigrations) {
      try { db.exec(sql); } catch (e) {
        if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) throw e;
      }
    }

    // FTS5 search tables
    for (const sql of searchMigrations) {
      try { db.exec(sql); } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }
    }

    // Direct messaging tables
    for (const sql of messagingMigrations) {
      try { db.exec(sql); } catch (e) {
        if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) throw e;
      }
    }

    console.log('Database migration completed successfully');

    // Seed default gifts if none exist
    const giftCount = db.prepare('SELECT COUNT(*) as count FROM gifts').get();
    if (giftCount.count === 0) {
      console.log('Seeding default gifts...');
      const insertGift = db.prepare(
        'INSERT INTO gifts (id, name, icon_url, animation_url, coin_cost) VALUES (?, ?, ?, ?, ?)'
      );
      const defaultGifts = [
        [uuidv4(), 'Rose', 'https://em-content.zobj.net/source/apple/391/rose_1f339.png', null, 1],
        [uuidv4(), 'Heart', 'https://em-content.zobj.net/source/apple/391/red-heart_2764-fe0f.png', null, 5],
        [uuidv4(), 'Star', 'https://em-content.zobj.net/source/apple/391/glowing-star_1f31f.png', null, 10],
        [uuidv4(), 'Fire', 'https://em-content.zobj.net/source/apple/391/fire_1f525.png', null, 25],
        [uuidv4(), 'Diamond', 'https://em-content.zobj.net/source/apple/391/gem-stone_1f48e.png', null, 50],
        [uuidv4(), 'Crown', 'https://em-content.zobj.net/source/apple/391/crown_1f451.png', null, 100],
        [uuidv4(), 'Rocket', 'https://em-content.zobj.net/source/apple/391/rocket_1f680.png', null, 200],
        [uuidv4(), 'Castle', 'https://em-content.zobj.net/source/apple/391/castle_1f3f0.png', null, 500],
        [uuidv4(), 'Lion', 'https://em-content.zobj.net/source/apple/391/lion_1f981.png', null, 1000],
        [uuidv4(), 'Universe', 'https://em-content.zobj.net/source/apple/391/milky-way_1f30c.png', null, 5000],
      ];
      const insertMany = db.transaction((gifts) => {
        for (const gift of gifts) {
          insertGift.run(...gift);
        }
      });
      insertMany(defaultGifts);
      console.log(`Seeded ${defaultGifts.length} gifts`);
    }

    // Seed sample data if no videos exist
    const videoCount = db.prepare('SELECT COUNT(*) as count FROM videos').get();
    if (videoCount.count === 0) {
      console.log('Seeding sample data...');

      // Create sample users (25 total)
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('password123', 12);
      const users = [
        // Original 8 (indices 0-7)
        [uuidv4(), 'demo@grgr.app', '+1234567890', hash, 'demouser', 'Demo User', null, 'Just vibing on Grgr!', 1000],
        [uuidv4(), 'creator@grgr.app', '+1234567891', hash, 'creator1', 'Top Creator', null, 'Live streaming daily!', 5000],
        [uuidv4(), 'star@grgr.app', '+1234567892', hash, 'starlight', 'Star Light', null, 'Dance & Music lover', 3000],
        [uuidv4(), 'dance@grgr.app', '+1234567893', hash, 'dancequeen', 'Dance Queen', null, 'Professional dancer & choreographer', 4200],
        [uuidv4(), 'gamer@grgr.app', '+1234567894', hash, 'gamerbro', 'Gamer Bro', null, 'Streaming games 24/7 | Top 500', 7500],
        [uuidv4(), 'music@grgr.app', '+1234567895', hash, 'musicvibes', 'Music Vibes', null, 'Producer | Singer | Songwriter', 2800],
        [uuidv4(), 'art@grgr.app', '+1234567896', hash, 'artistry', 'Art Is Try', null, 'Digital art & speed paintings', 1500],
        [uuidv4(), 'comedy@grgr.app', '+1234567897', hash, 'comedyking', 'Comedy King', null, 'Making you laugh one vid at a time', 6100],
        // New 17 users (indices 8-24)
        [uuidv4(), 'travel@grgr.app', '+1234567898', hash, 'wanderlust', 'Wander Lust', null, 'Exploring the world one city at a time', 4800],
        [uuidv4(), 'fitness@grgr.app', '+1234567899', hash, 'fitfam', 'Fit Fam', null, 'Personal trainer | HIIT & Yoga | Transform your body', 9200],
        [uuidv4(), 'fashion@grgr.app', '+1234567900', hash, 'styleguru', 'Style Guru', null, 'Fashion blogger | Outfit inspo daily', 11300],
        [uuidv4(), 'chef@grgr.app', '+1234567901', hash, 'cheflife', 'Chef Life', null, 'Culinary school grad | Quick recipes under 5 min', 3600],
        [uuidv4(), 'tech@grgr.app', '+1234567902', hash, 'techgeek', 'Tech Geek', null, 'Reviewing the latest gadgets & apps', 5400],
        [uuidv4(), 'nature@grgr.app', '+1234567903', hash, 'wildlens', 'Wild Lens', null, 'Wildlife photographer | Nature lover', 2100],
        [uuidv4(), 'diy@grgr.app', '+1234567904', hash, 'craftymom', 'Crafty Mom', null, 'DIY queen | Life hacks | Home decor', 7800],
        [uuidv4(), 'skate@grgr.app', '+1234567905', hash, 'sk8ordie', 'Sk8 or Die', null, 'Pro skater | Trick tutorials | Street vibes', 6700],
        [uuidv4(), 'makeup@grgr.app', '+1234567906', hash, 'glambygrace', 'Glam by Grace', null, 'MUA | Tutorials & transformations', 14500],
        [uuidv4(), 'film@grgr.app', '+1234567907', hash, 'cinemaclub', 'Cinema Club', null, 'Short films & cinematography tips', 3200],
        [uuidv4(), 'pet@grgr.app', '+1234567908', hash, 'pawsome', 'Pawsome Pets', null, 'Cute animals to brighten your day', 18900],
        [uuidv4(), 'motivation@grgr.app', '+1234567909', hash, 'risegrind', 'Rise & Grind', null, 'Motivation | Mindset | Hustle culture', 8100],
        [uuidv4(), 'asmr@grgr.app', '+1234567910', hash, 'whisperwave', 'Whisper Wave', null, 'ASMR for sleep & relaxation', 5600],
        [uuidv4(), 'soccer@grgr.app', '+1234567911', hash, 'golazo', 'Golazo', null, 'Football highlights & skills', 12400],
        [uuidv4(), 'bookworm@grgr.app', '+1234567912', hash, 'booktokk', 'Book Tokk', null, 'BookTok | Reviews | Recommendations', 4300],
        [uuidv4(), 'car@grgr.app', '+1234567913', hash, 'turbolife', 'Turbo Life', null, 'Car builds | Mods | Track days', 9800],
        [uuidv4(), 'garden@grgr.app', '+1234567914', hash, 'greenthumb', 'Green Thumb', null, 'Urban gardening | Plant care tips', 2700],
      ];
      const insertUser = db.prepare(
        'INSERT INTO users (id, email, phone, password_hash, username, display_name, avatar_url, bio, coin_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insertUsers = db.transaction((u) => {
        for (const user of u) insertUser.run(...user);
      });
      insertUsers(users);

      // Create sample videos (60 total)
      // Google sample video pool (public domain / CC)
      // Video URLs + corresponding thumbnail images from Google sample bucket
      const V = {
        blazes: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        escapes: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        fun: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        joyrides: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        meltdowns: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        bunny: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        elephants: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        sintel: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        subaru: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
        tears: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      };
      // Thumbnail images for each sample video
      const T = {
        blazes: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
        escapes: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
        fun: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
        joyrides: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg',
        meltdowns: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg',
        bunny: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        elephants: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
        sintel: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
        subaru: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg',
        tears: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
      };
      const sampleVideos = [
        // --- Original users (0-7) ---
        { url: V.blazes, caption: 'Check out this amazing view! #travel #adventure', userIdx: 0, duration: 15, views: 8432, likes: 3201, comments: 87 },
        { url: V.escapes, caption: 'Dancing in the rain #dance #fun #viral', userIdx: 1, duration: 22, views: 15670, likes: 7845, comments: 312 },
        { url: V.fun, caption: 'Cooking my favorite recipe #food #cooking', userIdx: 2, duration: 30, views: 4521, likes: 1890, comments: 56 },
        { url: V.joyrides, caption: 'Morning workout routine #fitness #health', userIdx: 0, duration: 45, views: 9210, likes: 4100, comments: 145 },
        { url: V.meltdowns, caption: 'Sunset vibes #nature #beautiful', userIdx: 1, duration: 18, views: 22340, likes: 11200, comments: 430 },
        { url: V.bunny, caption: 'This bunny has NO chill #animation #funny #viral', userIdx: 7, duration: 60, views: 45200, likes: 23100, comments: 890 },
        { url: V.elephants, caption: 'When your imagination runs wild #art #creative', userIdx: 6, duration: 55, views: 18900, likes: 9400, comments: 267 },
        { url: V.sintel, caption: 'Epic dragon fight scene #fantasy #epic #mustwatch', userIdx: 4, duration: 52, views: 67300, likes: 34500, comments: 1540 },
        { url: V.subaru, caption: 'Off-road adventures are the best #cars #adventure #offroad', userIdx: 4, duration: 35, views: 12800, likes: 5600, comments: 198 },
        { url: V.tears, caption: 'The feels hit different at night #emotional #cinematic', userIdx: 5, duration: 48, views: 31200, likes: 16800, comments: 720 },
        { url: V.blazes, caption: 'New choreo just dropped! Learn it with me #dance #tutorial', userIdx: 3, duration: 38, views: 52400, likes: 28900, comments: 1320 },
        { url: V.escapes, caption: 'POV: you finally beat the final boss #gaming #victory', userIdx: 4, duration: 25, views: 41000, likes: 19800, comments: 876 },
        { url: V.fun, caption: 'Painting a portrait in under 60 seconds #art #speedpaint', userIdx: 6, duration: 58, views: 29500, likes: 14200, comments: 445 },
        { url: V.joyrides, caption: 'Try not to laugh challenge #comedy #funny #challenge', userIdx: 7, duration: 42, views: 88900, likes: 45600, comments: 2340 },
        { url: V.meltdowns, caption: 'Acoustic cover of your favorite song #music #acoustic #cover', userIdx: 5, duration: 50, views: 37600, likes: 20100, comments: 915 },
        { url: V.bunny, caption: 'Day in my life as a full-time creator #vlog #dayinmylife', userIdx: 1, duration: 60, views: 19400, likes: 8700, comments: 334 },
        { url: V.elephants, caption: 'This transition took me 3 days #editing #transition #viral', userIdx: 3, duration: 20, views: 71200, likes: 38900, comments: 1780 },
        { url: V.sintel, caption: 'Storytime: my craziest concert experience #storytime #music', userIdx: 5, duration: 45, views: 14300, likes: 6800, comments: 289 },
        { url: V.subaru, caption: 'Rate my setup 1-10 #gaming #setup #pcgaming', userIdx: 4, duration: 28, views: 56700, likes: 29400, comments: 2100 },
        { url: V.tears, caption: 'When your mom walks in during a livestream #comedy #relatable', userIdx: 7, duration: 16, views: 102000, likes: 58300, comments: 3450 },

        // --- wanderlust (8) - travel content ---
        { url: V.blazes, caption: 'Hidden gems in Tokyo you NEED to visit #travel #tokyo #japan', userIdx: 8, duration: 42, views: 34500, likes: 18200, comments: 678 },
        { url: V.joyrides, caption: 'Backpacking through South America - Month 3 #travel #backpacking #adventure', userIdx: 8, duration: 55, views: 28100, likes: 15400, comments: 543 },

        // --- fitfam (9) - fitness content ---
        { url: V.escapes, caption: '15 min HIIT that will DESTROY you #fitness #hiit #workout', userIdx: 9, duration: 48, views: 67800, likes: 38200, comments: 1890 },
        { url: V.meltdowns, caption: 'My clients transformation in 90 days #fitness #transformation #motivation', userIdx: 9, duration: 30, views: 145000, likes: 82000, comments: 4200 },
        { url: V.fun, caption: 'What I eat in a day - 2500 calories #fitness #mealprep #nutrition', userIdx: 9, duration: 35, views: 52300, likes: 24100, comments: 1120 },

        // --- styleguru (10) - fashion content ---
        { url: V.tears, caption: 'Spring outfit ideas with pieces you already own #fashion #ootd #style', userIdx: 10, duration: 38, views: 89400, likes: 51200, comments: 2340 },
        { url: V.elephants, caption: 'Thrift flip challenge - $20 budget #fashion #thrift #diy', userIdx: 10, duration: 45, views: 112000, likes: 67800, comments: 3100 },

        // --- cheflife (11) - cooking content ---
        { url: V.fun, caption: '5 minute pasta that tastes like a restaurant #cooking #pasta #recipe', userIdx: 11, duration: 32, views: 234000, likes: 128000, comments: 5600 },
        { url: V.blazes, caption: 'Making the PERFECT steak at home #cooking #steak #foodie', userIdx: 11, duration: 40, views: 187000, likes: 98000, comments: 4100 },
        { url: V.meltdowns, caption: 'Street food tour in Bangkok #food #streetfood #thailand', userIdx: 11, duration: 55, views: 76500, likes: 42000, comments: 1950 },

        // --- techgeek (12) - tech reviews ---
        { url: V.subaru, caption: 'This $50 gadget replaced my $500 setup #tech #gadgets #review', userIdx: 12, duration: 35, views: 156000, likes: 89000, comments: 4800 },
        { url: V.sintel, caption: 'Building a gaming PC for under $800 #tech #pcbuild #gaming', userIdx: 12, duration: 58, views: 98700, likes: 52000, comments: 3200 },

        // --- wildlens (13) - nature/wildlife ---
        { url: V.bunny, caption: 'Baby foxes playing in my backyard #nature #wildlife #cute', userIdx: 13, duration: 28, views: 312000, likes: 198000, comments: 8900 },
        { url: V.elephants, caption: 'Sunrise over the mountains - no filter needed #nature #photography #mountains', userIdx: 13, duration: 20, views: 87600, likes: 54000, comments: 1670 },

        // --- craftymom (14) - DIY content ---
        { url: V.fun, caption: 'Dollar store DIY that looks expensive #diy #crafts #homedecor', userIdx: 14, duration: 42, views: 178000, likes: 95000, comments: 4300 },
        { url: V.escapes, caption: 'Life hacks you actually NEED to know #lifehacks #hacks #tips', userIdx: 14, duration: 35, views: 256000, likes: 142000, comments: 6100 },
        { url: V.blazes, caption: 'Organizing my entire pantry in one day #organization #satisfying #clean', userIdx: 14, duration: 50, views: 134000, likes: 78000, comments: 3400 },

        // --- sk8ordie (15) - skateboarding ---
        { url: V.joyrides, caption: 'Landed this trick after 200 attempts #skateboarding #tricks #nevergiveup', userIdx: 15, duration: 18, views: 445000, likes: 267000, comments: 12000 },
        { url: V.subaru, caption: 'Skating through downtown at 3am #skating #night #vibes', userIdx: 15, duration: 25, views: 89300, likes: 48000, comments: 2100 },

        // --- glambygrace (16) - makeup ---
        { url: V.tears, caption: 'Full glam in under 10 minutes #makeup #beauty #grwm', userIdx: 16, duration: 45, views: 198000, likes: 112000, comments: 5200 },
        { url: V.meltdowns, caption: 'Recreating celebrity looks for $10 #makeup #dupe #affordable', userIdx: 16, duration: 38, views: 167000, likes: 94000, comments: 4100 },
        { url: V.sintel, caption: 'My skincare routine that cleared my acne #skincare #beauty #routine', userIdx: 16, duration: 50, views: 278000, likes: 156000, comments: 7800 },

        // --- cinemaclub (17) - film ---
        { url: V.sintel, caption: 'I made a short film with just my phone #filmmaking #shortfilm #cinema', userIdx: 17, duration: 58, views: 56700, likes: 32000, comments: 1400 },
        { url: V.tears, caption: 'Cinematography tricks anyone can learn #cinematography #tips #filmtok', userIdx: 17, duration: 40, views: 43200, likes: 24000, comments: 980 },

        // --- pawsome (18) - pets ---
        { url: V.bunny, caption: 'My cat thinks he is a dog #pets #cats #funny', userIdx: 18, duration: 22, views: 567000, likes: 345000, comments: 15000 },
        { url: V.fun, caption: 'Golden retriever vs mirror - WHO WINS? #dogs #funny #cute', userIdx: 18, duration: 18, views: 789000, likes: 478000, comments: 21000 },
        { url: V.escapes, caption: 'Rescue kitten first day home #adoption #rescue #wholesome', userIdx: 18, duration: 30, views: 423000, likes: 267000, comments: 12400 },

        // --- risegrind (19) - motivation ---
        { url: V.joyrides, caption: 'Your Monday motivation is here #motivation #mindset #success', userIdx: 19, duration: 25, views: 78900, likes: 42000, comments: 1800 },
        { url: V.blazes, caption: 'From broke to 6 figures - my story #entrepreneur #hustle #grind', userIdx: 19, duration: 55, views: 134000, likes: 72000, comments: 3400 },

        // --- whisperwave (20) - ASMR ---
        { url: V.meltdowns, caption: 'Tapping and scratching sounds for sleep #asmr #sleep #relaxing', userIdx: 20, duration: 58, views: 234000, likes: 124000, comments: 4500 },
        { url: V.elephants, caption: 'Whispering your positive affirmations #asmr #whisper #positivity', userIdx: 20, duration: 45, views: 167000, likes: 89000, comments: 3200 },

        // --- golazo (21) - soccer ---
        { url: V.escapes, caption: 'INSANE goal from last nights match #soccer #football #goal', userIdx: 21, duration: 15, views: 456000, likes: 278000, comments: 13000 },
        { url: V.joyrides, caption: 'Skills tutorial: the rainbow flick #soccer #skills #tutorial', userIdx: 21, duration: 32, views: 189000, likes: 98000, comments: 4500 },
        { url: V.subaru, caption: 'Matchday vlog - behind the scenes #soccer #vlog #matchday', userIdx: 21, duration: 48, views: 67800, likes: 34000, comments: 1560 },

        // --- booktokk (22) - books ---
        { url: V.tears, caption: 'Books that will change your life in 2026 #booktok #reading #books', userIdx: 22, duration: 35, views: 89400, likes: 52000, comments: 2800 },
        { url: V.sintel, caption: 'Unpopular book opinions that will make you mad #booktok #controversy', userIdx: 22, duration: 28, views: 123000, likes: 67000, comments: 5400 },

        // --- turbolife (23) - cars ---
        { url: V.subaru, caption: 'Building my dream car from scratch - Episode 1 #cars #build #turbo', userIdx: 23, duration: 55, views: 178000, likes: 98000, comments: 4200 },
        { url: V.joyrides, caption: 'Supercar spotting in Monaco #cars #supercar #luxury', userIdx: 23, duration: 22, views: 234000, likes: 134000, comments: 5800 },
        { url: V.blazes, caption: 'Track day with the boys #racing #trackday #speed', userIdx: 23, duration: 38, views: 145000, likes: 78000, comments: 3400 },

        // --- greenthumb (24) - gardening ---
        { url: V.bunny, caption: 'Growing tomatoes on my apartment balcony #gardening #plants #urban', userIdx: 24, duration: 40, views: 67800, likes: 38000, comments: 1670 },
        { url: V.fun, caption: 'Plant care mistakes everyone makes #plants #tips #gardening', userIdx: 24, duration: 32, views: 89400, likes: 48000, comments: 2100 },
      ];

      const videoIds = [];
      const insertVideo = db.prepare(
        'INSERT INTO videos (id, user_id, video_url, thumbnail_url, caption, duration, view_count, like_count, comment_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      // Map video URLs to thumbnail URLs
      const videoToThumb = {};
      for (const key of Object.keys(V)) {
        videoToThumb[V[key]] = T[key] || null;
      }
      const insertVideos = db.transaction(() => {
        for (const v of sampleVideos) {
          const videoId = uuidv4();
          videoIds.push(videoId);
          const thumb = videoToThumb[v.url] || null;
          insertVideo.run(
            videoId, users[v.userIdx][0], v.url, thumb, v.caption,
            v.duration, v.views, v.likes, v.comments
          );
        }
      });
      insertVideos();
      console.log(`Seeded ${sampleVideos.length} videos`);

      // Parse hashtags from video captions and create hashtag + video_hashtags records
      const insertHashtag = db.prepare(
        `INSERT INTO hashtags (id, name, video_count, total_engagement, trending_score)
         VALUES (?, ?, 1, 0, 0)
         ON CONFLICT(name) DO UPDATE SET video_count = video_count + 1, updated_at = datetime('now')`
      );
      const getHashtagRow = db.prepare(`SELECT id FROM hashtags WHERE name = ?`);
      const insertVideoHashtag = db.prepare(
        `INSERT OR IGNORE INTO video_hashtags (video_id, hashtag_id) VALUES (?, ?)`
      );
      const seedHashtags = db.transaction(() => {
        for (let i = 0; i < sampleVideos.length; i++) {
          const caption = sampleVideos[i].caption;
          if (!caption) continue;
          const matches = caption.match(/#(\w+)/g);
          if (!matches) continue;
          const tags = [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
          for (const tag of tags) {
            const hid = uuidv4();
            insertHashtag.run(hid, tag);
            const row = getHashtagRow.get(tag);
            if (row) {
              insertVideoHashtag.run(videoIds[i], row.id);
            }
          }
        }
      });
      seedHashtags();
      console.log('Seeded hashtags from video captions');

      // Create 7 active livestreams
      const insertLivestream = db.prepare(
        'INSERT INTO livestreams (id, host_id, title, thumbnail_url, is_active, viewer_count, total_gifts_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const livestreams = [
        [uuidv4(), users[3][0], 'Friday Night Dance Party', null, 1, 1243, 8500],
        [uuidv4(), users[4][0], 'Gaming Marathon - 24hr Challenge', null, 1, 3891, 22400],
        [uuidv4(), users[5][0], 'Chill & Chat - Late Night Vibes', null, 1, 672, 3200],
        [uuidv4(), users[9][0], 'Live Workout - Join Me!', null, 1, 2156, 14200],
        [uuidv4(), users[16][0], 'GRWM Live - Date Night Glam', null, 1, 4520, 31000],
        [uuidv4(), users[18][0], 'Puppy Cam - Watch My Puppies Play', null, 1, 8934, 52000],
        [uuidv4(), users[21][0], 'Watching The Match Together', null, 1, 6780, 18500],
      ];
      const insertLivestreams = db.transaction(() => {
        for (const ls of livestreams) insertLivestream.run(...ls);
      });
      insertLivestreams();

      // Mark livestream hosts as live
      const setLive = db.prepare('UPDATE users SET is_live = 1 WHERE id = ?');
      const liveHostIndices = [3, 4, 5, 9, 16, 18, 21];
      for (const idx of liveHostIndices) setLive.run(users[idx][0]);
      console.log(`Seeded ${livestreams.length} active livestreams`);

      // Create follow relationships
      const insertFollow = db.prepare(
        'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)'
      );
      const follows = [
        // demouser follows many creators
        [users[0][0], users[1][0]], [users[0][0], users[2][0]], [users[0][0], users[3][0]],
        [users[0][0], users[4][0]], [users[0][0], users[9][0]], [users[0][0], users[11][0]],
        [users[0][0], users[15][0]], [users[0][0], users[18][0]], [users[0][0], users[21][0]],
        // creator1
        [users[1][0], users[2][0]], [users[1][0], users[3][0]], [users[1][0], users[7][0]],
        [users[1][0], users[10][0]], [users[1][0], users[16][0]],
        // starlight
        [users[2][0], users[3][0]], [users[2][0], users[5][0]], [users[2][0], users[16][0]],
        // dancequeen
        [users[3][0], users[1][0]], [users[3][0], users[5][0]], [users[3][0], users[7][0]],
        [users[3][0], users[9][0]], [users[3][0], users[15][0]],
        // gamerbro
        [users[4][0], users[7][0]], [users[4][0], users[0][0]], [users[4][0], users[12][0]],
        [users[4][0], users[23][0]],
        // musicvibes
        [users[5][0], users[6][0]], [users[5][0], users[3][0]], [users[5][0], users[2][0]],
        [users[5][0], users[20][0]],
        // artistry
        [users[6][0], users[5][0]], [users[6][0], users[1][0]], [users[6][0], users[17][0]],
        // comedyking
        [users[7][0], users[4][0]], [users[7][0], users[0][0]], [users[7][0], users[3][0]],
        [users[7][0], users[18][0]], [users[7][0], users[19][0]],
        // wanderlust (8)
        [users[8][0], users[13][0]], [users[8][0], users[11][0]], [users[8][0], users[0][0]],
        [users[8][0], users[24][0]],
        // fitfam (9)
        [users[9][0], users[11][0]], [users[9][0], users[19][0]], [users[9][0], users[3][0]],
        [users[9][0], users[15][0]], [users[9][0], users[0][0]],
        // styleguru (10)
        [users[10][0], users[16][0]], [users[10][0], users[14][0]], [users[10][0], users[1][0]],
        [users[10][0], users[22][0]],
        // cheflife (11)
        [users[11][0], users[8][0]], [users[11][0], users[14][0]], [users[11][0], users[24][0]],
        // techgeek (12)
        [users[12][0], users[4][0]], [users[12][0], users[23][0]], [users[12][0], users[17][0]],
        // wildlens (13)
        [users[13][0], users[8][0]], [users[13][0], users[24][0]], [users[13][0], users[18][0]],
        // craftymom (14)
        [users[14][0], users[11][0]], [users[14][0], users[24][0]], [users[14][0], users[10][0]],
        [users[14][0], users[16][0]],
        // sk8ordie (15)
        [users[15][0], users[4][0]], [users[15][0], users[7][0]], [users[15][0], users[23][0]],
        [users[15][0], users[21][0]],
        // glambygrace (16)
        [users[16][0], users[10][0]], [users[16][0], users[14][0]], [users[16][0], users[2][0]],
        [users[16][0], users[3][0]],
        // cinemaclub (17)
        [users[17][0], users[6][0]], [users[17][0], users[13][0]], [users[17][0], users[5][0]],
        // pawsome (18)
        [users[18][0], users[13][0]], [users[18][0], users[7][0]], [users[18][0], users[0][0]],
        [users[18][0], users[24][0]], [users[18][0], users[14][0]],
        // risegrind (19)
        [users[19][0], users[9][0]], [users[19][0], users[12][0]], [users[19][0], users[22][0]],
        // whisperwave (20)
        [users[20][0], users[5][0]], [users[20][0], users[13][0]], [users[20][0], users[22][0]],
        // golazo (21)
        [users[21][0], users[9][0]], [users[21][0], users[15][0]], [users[21][0], users[4][0]],
        [users[21][0], users[23][0]],
        // booktokk (22)
        [users[22][0], users[17][0]], [users[22][0], users[20][0]], [users[22][0], users[6][0]],
        // turbolife (23)
        [users[23][0], users[4][0]], [users[23][0], users[12][0]], [users[23][0], users[15][0]],
        [users[23][0], users[21][0]],
        // greenthumb (24)
        [users[24][0], users[13][0]], [users[24][0], users[14][0]], [users[24][0], users[11][0]],
        [users[24][0], users[8][0]],
      ];
      const insertFollows = db.transaction(() => {
        for (const f of follows) insertFollow.run(...f);
      });
      insertFollows();
      console.log(`Seeded ${follows.length} follow relationships`);

      // Create sample comments on videos (75 comments)
      const insertComment = db.prepare(
        'INSERT INTO comments (id, video_id, user_id, content) VALUES (?, ?, ?, ?)'
      );
      const commentTexts = [
        'This is absolutely fire!',
        'How do you do that?! Teach me!',
        'Best video on my feed today',
        'Wow the vibes are immaculate',
        'I watched this 10 times already',
        'Underrated content right here',
        'The editing is insane',
        'You always deliver quality content',
        'This made my whole day better',
        'Tutorial when??',
        'Collab with me please!',
        'Your talent is unreal',
        'I literally cannot stop watching this',
        'The transition at 0:15 is chef\'s kiss',
        'New favorite creator for sure',
        'This deserves way more views',
        'Song name anyone?',
        'POV: you found the best content on Grgr',
        'Notifications ON for your content',
        'My jaw literally dropped',
        'Adding this to my favorites',
        'The energy is unmatched',
        'First time here and already a fan',
        'You should go live more often!',
        'This is why I love this app',
        'Okay this is actually insane',
        'I need a part 2 immediately',
        'Sharing this with everyone I know',
        'The way you did that at 0:30 was SO smooth',
        'Bro this just appeared on my fyp and I can\'t scroll past',
        'This is the content I signed up for',
        'SCREAMING this is so good',
        'Every video you post is a banger',
        'Wait this is actually helpful thank you',
        'Not me watching this at 3am',
        'Can we talk about how underrated this creator is',
        'The algorithm finally did something right',
        'This needs to go viral ASAP',
        'I keep coming back to this video',
        'You just gained a new follower',
        'Why is no one talking about this',
        'Literally saving this for later',
        'The aesthetic is everything',
        'Drop the playlist please',
        'This made me smile on a bad day',
        'W content as always',
        'Just showed this to my whole family',
        'The quality keeps getting better every time',
        'I need to try this myself',
        'Genuinely the best thing I\'ve seen today',
        'Okay I\'m officially obsessed',
        'More of this content please',
        'You really don\'t miss huh',
        'The creativity is off the charts',
        'Subscribing immediately',
        'This gives me so much inspiration',
        'I literally gasped',
        'Can\'t wait for the next one',
        'You make it look so easy',
        'This deserves millions of views tbh',
        'Finally some quality content on my feed',
        'The vibe check is immaculate',
        'Crying this is so beautiful',
        'How are you so talented??',
        'Adding you to my favorites list',
        'This is peak content creation',
        'POV: you discover the best creator on the app',
        'RIP my productivity after finding this account',
        'The sound design is incredible',
        'Okay but can we appreciate the effort here',
        'Legend, absolute legend',
        'I showed this to my friend and they followed immediately',
        'This is art. Pure art.',
        'Gonna need a full tutorial on this',
        'The best 60 seconds of my day',
      ];
      const comments = [];
      // Spread comments across multiple videos from various users
      for (let i = 0; i < commentTexts.length; i++) {
        const videoIdx = i % videoIds.length;
        // Pick a commenter different from the video owner
        const videoOwnerIdx = sampleVideos[videoIdx].userIdx;
        let commenterIdx = (videoOwnerIdx + 1 + (i % (users.length - 1))) % users.length;
        if (commenterIdx === videoOwnerIdx) commenterIdx = (commenterIdx + 1) % users.length;
        comments.push([uuidv4(), videoIds[videoIdx], users[commenterIdx][0], commentTexts[i]]);
      }
      const insertComments = db.transaction(() => {
        for (const c of comments) insertComment.run(...c);
      });
      insertComments();
      console.log(`Seeded ${comments.length} comments`);

      console.log('Seeded sample users, videos, livestreams, follows, and comments');
      console.log('Demo login: demouser / password123');
    }

    // Rebuild FTS search index (always, to keep in sync)
    rebuildSearchIndex(db);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    db.close();
  }
}

migrate();
