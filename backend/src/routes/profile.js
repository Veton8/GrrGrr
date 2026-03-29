const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireActiveUser, moderateField } = require('../middleware/moderation');
const {
  getProfile,
  uploadAvatar,
  updateProfile,
  followUser,
  unfollowUser,
  getUserVideos,
  getFollowers,
  getFollowing,
} = require('../controllers/profileController');

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads', 'avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

router.post('/me/avatar', authenticate, requireActiveUser, avatarUpload.single('avatar'), uploadAvatar);
router.put('/me', authenticate, requireActiveUser, moderateField('bio'), updateProfile);
router.get('/:userId/followers', optionalAuth, getFollowers);
router.get('/:userId/following', optionalAuth, getFollowing);
router.get('/:username/videos', getUserVideos);
router.post('/:userId/follow', authenticate, followUser);
router.delete('/:userId/follow', authenticate, unfollowUser);
router.get('/:username', optionalAuth, getProfile);

module.exports = router;
