const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  registerPushToken,
  unregisterPushToken,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
} = require('../controllers/notificationController');

// Push token management
router.post('/push-token', authenticate, registerPushToken);
router.delete('/push-token', authenticate, unregisterPushToken);

// Notification center
router.get('/', authenticate, getNotifications);
router.post('/:notifId/read', authenticate, markAsRead);
router.post('/read-all', authenticate, markAllAsRead);

// Preferences
router.get('/preferences', authenticate, getPreferences);
router.put('/preferences', authenticate, updatePreferences);

module.exports = router;
