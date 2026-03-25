const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getGifts, sendGift, purchaseCoins } = require('../controllers/giftController');

router.get('/', getGifts);
router.post('/send', authenticate, sendGift);
router.post('/coins/purchase', authenticate, purchaseCoins);

module.exports = router;
