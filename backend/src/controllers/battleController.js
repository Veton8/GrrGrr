const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function createBattle(req, res, next) {
  try {
    const { livestreamId, opponentId, durationSeconds = 300 } = req.body;
    const id = uuidv4();

    sqlite
      .prepare(
        `INSERT INTO battles (id, livestream_id, creator_a_id, creator_b_id, duration_seconds, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(id, livestreamId, req.user.id, opponentId, durationSeconds);

    const battle = sqlite.prepare('SELECT * FROM battles WHERE id = ?').get(id);
    res.status(201).json(battle);
  } catch (err) {
    next(err);
  }
}

async function acceptBattle(req, res, next) {
  try {
    const { battleId } = req.params;
    const info = sqlite
      .prepare(
        `UPDATE battles SET status = 'active', started_at = datetime('now')
         WHERE id = ? AND creator_b_id = ? AND status = 'pending'`
      )
      .run(battleId, req.user.id);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Battle not found or already started' });
    }

    const battle = sqlite.prepare('SELECT * FROM battles WHERE id = ?').get(battleId);
    res.json(battle);
  } catch (err) {
    next(err);
  }
}

async function getBattle(req, res, next) {
  try {
    const { battleId } = req.params;
    const battle = sqlite
      .prepare(
        `SELECT b.*,
                a.username as creator_a_username, a.display_name as creator_a_name, a.avatar_url as creator_a_avatar,
                bb.username as creator_b_username, bb.display_name as creator_b_name, bb.avatar_url as creator_b_avatar
         FROM battles b
         JOIN users a ON b.creator_a_id = a.id
         JOIN users bb ON b.creator_b_id = bb.id
         WHERE b.id = ?`
      )
      .get(battleId);

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    res.json(battle);
  } catch (err) {
    next(err);
  }
}

async function endBattle(req, res, next) {
  try {
    const { battleId } = req.params;
    const b = sqlite
      .prepare("SELECT * FROM battles WHERE id = ? AND status = 'active'")
      .get(battleId);

    if (!b) {
      return res.status(404).json({ error: 'Active battle not found' });
    }

    const winnerId =
      b.creator_a_score > b.creator_b_score
        ? b.creator_a_id
        : b.creator_b_score > b.creator_a_score
          ? b.creator_b_id
          : null;

    sqlite
      .prepare("UPDATE battles SET status = 'ended', ended_at = datetime('now'), winner_id = ? WHERE id = ?")
      .run(winnerId, battleId);

    const battle = sqlite.prepare('SELECT * FROM battles WHERE id = ?').get(battleId);
    res.json(battle);
  } catch (err) {
    next(err);
  }
}

module.exports = { createBattle, acceptBattle, getBattle, endBattle };
