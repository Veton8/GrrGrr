const { sqlite } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logModeration } = require('../services/strikeService');

const VALID_REASONS = [
  'spam', 'nudity', 'violence', 'harassment',
  'hate_speech', 'minor_safety', 'copyright', 'other',
];

const VALID_TARGET_TYPES = ['video', 'comment', 'user', 'livestream'];

/** POST /api/reports — submit a user report. */
async function submitReport(req, res, next) {
  try {
    const { targetType, targetId, reason, description = '' } = req.body;

    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ error: `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(', ')}` });
    }
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}` });
    }
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' });
    }

    const id = uuidv4();

    // Determine priority
    let priority = 'normal';
    if (reason === 'minor_safety') {
      priority = 'critical';
    }

    // Check for escalation: 3+ reports on same content → high priority
    const existingCount = sqlite
      .prepare('SELECT COUNT(*) as count FROM reports WHERE target_type = ? AND target_id = ?')
      .get(targetType, targetId).count;

    if (existingCount >= 2) {
      // This report makes it 3+
      priority = priority === 'critical' ? 'critical' : 'high';
      // Also upgrade existing reports for this content to high
      sqlite
        .prepare("UPDATE reports SET priority = 'high' WHERE target_type = ? AND target_id = ? AND priority = 'normal'")
        .run(targetType, targetId);
    }

    sqlite
      .prepare(
        `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, description, status, priority)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(id, req.user.id, targetType, targetId, reason, description.trim(), priority);

    logModeration('report_submitted', req.user.id, targetId, { targetType, reason, priority });

    res.status(201).json({ id, status: 'pending', priority });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/reports — paginated report list with filters. */
async function getReports(req, res, next) {
  try {
    const { status, reason, priority, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params = [];

    if (status) {
      where += ' AND r.status = ?';
      params.push(status);
    }
    if (reason) {
      where += ' AND r.reason = ?';
      params.push(reason);
    }
    if (priority) {
      where += ' AND r.priority = ?';
      params.push(priority);
    }

    params.push(parseInt(limit), parseInt(offset));

    const rows = sqlite
      .prepare(
        `SELECT r.*, u.username as reporter_username
         FROM reports r
         LEFT JOIN users u ON r.reporter_id = u.id
         WHERE ${where}
         ORDER BY
           CASE r.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
           r.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params);

    const total = sqlite
      .prepare(`SELECT COUNT(*) as count FROM reports r WHERE ${where}`)
      .get(...params.slice(0, -2)).count;

    res.json({ reports: rows, total, page: parseInt(page), hasMore: rows.length === parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/reports/:id — update report status. */
async function updateReport(req, res, next) {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    const validStatuses = ['pending', 'reviewed', 'actioned', 'dismissed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'reviewed' || status === 'actioned' || status === 'dismissed') {
        updates.push("reviewed_at = datetime('now')");
        updates.push('reviewer_id = ?');
        params.push(req.user.id);
      }
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(id);
    sqlite
      .prepare(`UPDATE reports SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    logModeration('report_updated', req.user.id, id, { status, priority });

    const report = sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

module.exports = { submitReport, getReports, updateReport };
