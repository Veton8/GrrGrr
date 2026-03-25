const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getUserVideos,
} = require('../controllers/profileController');

router.get('/:username', optionalAuth, getProfile);
router.put('/me', authenticate, updateProfile);
router.post('/:userId/follow', authenticate, followUser);
router.delete('/:userId/follow', authenticate, unfollowUser);
router.get('/:username/videos', getUserVideos);

module.exports = router;
