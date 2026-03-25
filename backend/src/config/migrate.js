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

function migrate() {
  try {
    for (const sql of migrations) {
      db.exec(sql);
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

      // Create sample users (8 total)
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('password123', 12);
      const users = [
        [uuidv4(), 'demo@grgr.app', '+1234567890', hash, 'demouser', 'Demo User', null, 'Just vibing on Grgr!', 1000],
        [uuidv4(), 'creator@grgr.app', '+1234567891', hash, 'creator1', 'Top Creator', null, 'Live streaming daily!', 5000],
        [uuidv4(), 'star@grgr.app', '+1234567892', hash, 'starlight', 'Star Light', null, 'Dance & Music lover', 3000],
        [uuidv4(), 'dance@grgr.app', '+1234567893', hash, 'dancequeen', 'Dance Queen', null, 'Professional dancer & choreographer', 4200],
        [uuidv4(), 'gamer@grgr.app', '+1234567894', hash, 'gamerbro', 'Gamer Bro', null, 'Streaming games 24/7 | Top 500', 7500],
        [uuidv4(), 'music@grgr.app', '+1234567895', hash, 'musicvibes', 'Music Vibes', null, 'Producer | Singer | Songwriter', 2800],
        [uuidv4(), 'art@grgr.app', '+1234567896', hash, 'artistry', 'Art Is Try', null, 'Digital art & speed paintings', 1500],
        [uuidv4(), 'comedy@grgr.app', '+1234567897', hash, 'comedyking', 'Comedy King', null, 'Making you laugh one vid at a time', 6100],
      ];
      const insertUser = db.prepare(
        'INSERT INTO users (id, email, phone, password_hash, username, display_name, avatar_url, bio, coin_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insertUsers = db.transaction((u) => {
        for (const user of u) insertUser.run(...user);
      });
      insertUsers(users);

      // Create sample videos (20 total)
      const sampleVideos = [
        // Original 5
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', caption: 'Check out this amazing view! #travel #adventure', userIdx: 0, duration: 15, views: 8432, likes: 3201, comments: 87 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', caption: 'Dancing in the rain #dance #fun #viral', userIdx: 1, duration: 22, views: 15670, likes: 7845, comments: 312 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', caption: 'Cooking my favorite recipe #food #cooking', userIdx: 2, duration: 30, views: 4521, likes: 1890, comments: 56 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', caption: 'Morning workout routine #fitness #health', userIdx: 0, duration: 45, views: 9210, likes: 4100, comments: 145 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', caption: 'Sunset vibes #nature #beautiful', userIdx: 1, duration: 18, views: 22340, likes: 11200, comments: 430 },
        // New 15
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', caption: 'This bunny has NO chill #animation #funny #viral', userIdx: 7, duration: 60, views: 45200, likes: 23100, comments: 890 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', caption: 'When your imagination runs wild #art #creative', userIdx: 6, duration: 55, views: 18900, likes: 9400, comments: 267 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', caption: 'Epic dragon fight scene #fantasy #epic #mustwatch', userIdx: 4, duration: 52, views: 67300, likes: 34500, comments: 1540 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', caption: 'Off-road adventures are the best #cars #adventure #offroad', userIdx: 4, duration: 35, views: 12800, likes: 5600, comments: 198 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', caption: 'The feels hit different at night #emotional #cinematic', userIdx: 5, duration: 48, views: 31200, likes: 16800, comments: 720 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', caption: 'New choreo just dropped! Learn it with me #dance #tutorial', userIdx: 3, duration: 38, views: 52400, likes: 28900, comments: 1320 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', caption: 'POV: you finally beat the final boss #gaming #victory', userIdx: 4, duration: 25, views: 41000, likes: 19800, comments: 876 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', caption: 'Painting a portrait in under 60 seconds #art #speedpaint', userIdx: 6, duration: 58, views: 29500, likes: 14200, comments: 445 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', caption: 'Try not to laugh challenge #comedy #funny #challenge', userIdx: 7, duration: 42, views: 88900, likes: 45600, comments: 2340 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', caption: 'Acoustic cover of your favorite song #music #acoustic #cover', userIdx: 5, duration: 50, views: 37600, likes: 20100, comments: 915 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', caption: 'Day in my life as a full-time creator #vlog #dayinmylife', userIdx: 1, duration: 60, views: 19400, likes: 8700, comments: 334 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', caption: 'This transition took me 3 days #editing #transition #viral', userIdx: 3, duration: 20, views: 71200, likes: 38900, comments: 1780 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', caption: 'Storytime: my craziest concert experience #storytime #music', userIdx: 5, duration: 45, views: 14300, likes: 6800, comments: 289 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', caption: 'Rate my setup 1-10 #gaming #setup #pcgaming', userIdx: 4, duration: 28, views: 56700, likes: 29400, comments: 2100 },
        { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', caption: 'When your mom walks in during a livestream #comedy #relatable', userIdx: 7, duration: 16, views: 102000, likes: 58300, comments: 3450 },
      ];

      const videoIds = [];
      const insertVideo = db.prepare(
        'INSERT INTO videos (id, user_id, video_url, thumbnail_url, caption, duration, view_count, like_count, comment_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insertVideos = db.transaction(() => {
        for (const v of sampleVideos) {
          const videoId = uuidv4();
          videoIds.push(videoId);
          insertVideo.run(
            videoId, users[v.userIdx][0], v.url, null, v.caption,
            v.duration, v.views, v.likes, v.comments
          );
        }
      });
      insertVideos();
      console.log(`Seeded ${sampleVideos.length} videos`);

      // Create 3 active livestreams
      const insertLivestream = db.prepare(
        'INSERT INTO livestreams (id, host_id, title, thumbnail_url, is_active, viewer_count, total_gifts_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const livestreams = [
        [uuidv4(), users[3][0], 'Friday Night Dance Party', null, 1, 1243, 8500],
        [uuidv4(), users[4][0], 'Gaming Marathon - 24hr Challenge', null, 1, 3891, 22400],
        [uuidv4(), users[5][0], 'Chill & Chat - Late Night Vibes', null, 1, 672, 3200],
      ];
      const insertLivestreams = db.transaction(() => {
        for (const ls of livestreams) insertLivestream.run(...ls);
      });
      insertLivestreams();

      // Mark livestream hosts as live
      const setLive = db.prepare('UPDATE users SET is_live = 1 WHERE id = ?');
      setLive.run(users[3][0]);
      setLive.run(users[4][0]);
      setLive.run(users[5][0]);
      console.log('Seeded 3 active livestreams');

      // Create follow relationships
      const insertFollow = db.prepare(
        'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)'
      );
      const follows = [
        // demouser follows creator1, starlight, dancequeen, gamerbro
        [users[0][0], users[1][0]],
        [users[0][0], users[2][0]],
        [users[0][0], users[3][0]],
        [users[0][0], users[4][0]],
        // creator1 follows starlight, dancequeen, comedyking
        [users[1][0], users[2][0]],
        [users[1][0], users[3][0]],
        [users[1][0], users[7][0]],
        // starlight follows dancequeen, musicvibes
        [users[2][0], users[3][0]],
        [users[2][0], users[5][0]],
        // dancequeen follows creator1, musicvibes, comedyking
        [users[3][0], users[1][0]],
        [users[3][0], users[5][0]],
        [users[3][0], users[7][0]],
        // gamerbro follows comedyking, demouser
        [users[4][0], users[7][0]],
        [users[4][0], users[0][0]],
        // musicvibes follows artistry, dancequeen, starlight
        [users[5][0], users[6][0]],
        [users[5][0], users[3][0]],
        [users[5][0], users[2][0]],
        // artistry follows musicvibes, creator1
        [users[6][0], users[5][0]],
        [users[6][0], users[1][0]],
        // comedyking follows gamerbro, demouser, dancequeen
        [users[7][0], users[4][0]],
        [users[7][0], users[0][0]],
        [users[7][0], users[3][0]],
      ];
      const insertFollows = db.transaction(() => {
        for (const f of follows) insertFollow.run(...f);
      });
      insertFollows();
      console.log(`Seeded ${follows.length} follow relationships`);

      // Create sample comments on videos
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
      ];
      const comments = [];
      // Spread comments across multiple videos from various users
      for (let i = 0; i < commentTexts.length; i++) {
        const videoIdx = i % videoIds.length;
        // Pick a commenter different from the video owner
        const videoOwnerIdx = sampleVideos[videoIdx].userIdx;
        let commenterIdx = (videoOwnerIdx + 1 + (i % 7)) % users.length;
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
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    db.close();
  }
}

migrate();
