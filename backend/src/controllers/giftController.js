const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { queueNotification } = require('../services/notificationAggregator');

async function getGifts(req, res, next) {
  try {
    const rows = sqlite.prepare('SELECT * FROM gifts ORDER BY coin_cost ASC').all();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function sendGift(req, res, next) {
  try {
    const { giftId, receiverId, livestreamId, quantity = 1 } = req.body;

    const gift = sqlite.prepare('SELECT * FROM gifts WHERE id = ?').get(giftId);
    if (!gift) {
      return res.status(404).json({ error: 'Gift not found' });
    }

    const totalCost = gift.coin_cost * quantity;
    const sender = sqlite.prepare('SELECT coin_balance FROM users WHERE id = ?').get(req.user.id);
    if (sender.coin_balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Process transaction atomically
    const processGift = sqlite.transaction(() => {
      sqlite.prepare('UPDATE users SET coin_balance = coin_balance - ? WHERE id = ?').run(totalCost, req.user.id);
      sqlite.prepare('UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?').run(Math.floor(totalCost * 0.7), receiverId);
      sqlite.prepare(
        'INSERT INTO gift_transactions (id, sender_id, receiver_id, gift_id, livestream_id, quantity, total_coins) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), req.user.id, receiverId, giftId, livestreamId || null, quantity, totalCost);
      if (livestreamId) {
        sqlite.prepare('UPDATE livestreams SET total_gifts_value = total_gifts_value + ? WHERE id = ?').run(totalCost, livestreamId);
      }
    });
    processGift();

    // Notify the gift receiver
    queueNotification(receiverId, {
      type: 'gift_received',
      title: 'You received a gift!',
      body: `${req.user.username} sent you ${quantity}x ${gift.name} (${totalCost} coins)`,
      data: { giftId, giftName: gift.name, senderId: req.user.id, senderUsername: req.user.username, quantity, totalCost },
    });

    res.json({
      message: 'Gift sent',
      gift,
      quantity,
      totalCost,
      remainingBalance: sender.coin_balance - totalCost,
    });
  } catch (err) {
    next(err);
  }
}

async function purchaseCoins(req, res, next) {
  try {
    const { amount, paymentProvider, paymentId } = req.body;
    const priceCents = amount;

    sqlite.prepare('UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?').run(amount, req.user.id);
    sqlite.prepare(
      'INSERT INTO coin_purchases (id, user_id, amount, price_cents, payment_provider, payment_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), req.user.id, amount, priceCents, paymentProvider, paymentId);

    const user = sqlite.prepare('SELECT coin_balance FROM users WHERE id = ?').get(req.user.id);
    res.json({ coinBalance: user.coin_balance });
  } catch (err) {
    next(err);
  }
}

module.exports = { getGifts, sendGift, purchaseCoins };
