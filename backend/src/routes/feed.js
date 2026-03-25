const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  getFeed,
  likeVideo,
  unlikeVideo,
  getComments,
  addComment,
} = require('../controllers/feedController');

router.get('/', optionalAuth, getFeed);
router.post('/:videoId/like', authenticate, likeVideo);
router.delete('/:videoId/like', authenticate, unlikeVideo);
router.get('/:videoId/comments', getComments);
router.post('/:videoId/comments', authenticate, addComment);

module.exports = router;
