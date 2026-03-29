const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireActiveUser, moderateField } = require('../middleware/moderation');
const {
  getFeed,
  uploadVideo,
  likeVideo,
  unlikeVideo,
  getComments,
  addComment,
  getUploadUrl,
  processVideoEndpoint,
  getVideoStatus,
  recordVideoView,
  getForYouFeed,
  getFollowingFeed,
  getTrendingHashtagsEndpoint,
  getHashtagVideos,
  shareVideo,
} = require('../controllers/feedController');

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads', 'videos'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|mov|avi|mkv|webm/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

router.get('/', optionalAuth, getFeed);

// New feed endpoints (must be before /:videoId routes)
router.get('/foryou', optionalAuth, getForYouFeed);
router.get('/following', authenticate, getFollowingFeed);

// Hashtags (must be before /:videoId routes)
router.get('/hashtags/trending', getTrendingHashtagsEndpoint);
router.get('/hashtags/:name/videos', optionalAuth, getHashtagVideos);

// Upload
router.post('/upload', authenticate, requireActiveUser, upload.single('video'), uploadVideo);
router.post('/upload-url', authenticate, requireActiveUser, getUploadUrl);

// Video-specific routes (param routes last)
router.post('/:videoId/view', authenticate, recordVideoView);
router.post('/:videoId/process', authenticate, processVideoEndpoint);
router.get('/:videoId/status', getVideoStatus);
router.post('/:videoId/like', authenticate, likeVideo);
router.delete('/:videoId/like', authenticate, unlikeVideo);
router.post('/:videoId/share', authenticate, shareVideo);
router.get('/:videoId/comments', getComments);
router.post('/:videoId/comments', authenticate, requireActiveUser, moderateField('content'), addComment);

module.exports = router;
