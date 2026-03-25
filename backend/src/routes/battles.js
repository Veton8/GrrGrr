const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createBattle,
  acceptBattle,
  getBattle,
  endBattle,
} = require('../controllers/battleController');

router.post('/', authenticate, createBattle);
router.post('/:battleId/accept', authenticate, acceptBattle);
router.get('/:battleId', getBattle);
router.post('/:battleId/end', authenticate, endBattle);

module.exports = router;
