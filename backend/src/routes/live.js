const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { goLive, joinLive, endLive, getLiveStreams, getLiveStream } = require('../controllers/liveController');

router.get('/', getLiveStreams);
router.get('/:streamId', getLiveStream);
router.post('/start', authenticate, goLive);
router.post('/:streamId/join', authenticate, joinLive);
router.post('/:streamId/end', authenticate, endLive);

module.exports = router;
