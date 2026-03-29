const { checkUserStatus, logModeration } = require('../services/strikeService');

/**
 * Middleware that checks if the authenticated user is restricted or banned.
 * Use after `authenticate` on routes that create content (post, comment, upload, chat).
 */
function requireActiveUser(req, res, next) {
  if (!req.user) return next(); // Let auth middleware handle unauthenticated

  const status = checkUserStatus(req.user.id);

  if (status === 'banned') {
    return res.status(403).json({
      error: 'Your account has been suspended due to community guideline violations.',
      code: 'ACCOUNT_BANNED',
    });
  }

  if (status === 'restricted') {
    return res.status(403).json({
      error: 'Your account is temporarily restricted. You can browse but cannot post content.',
      code: 'ACCOUNT_RESTRICTED',
    });
  }

  next();
}

/**
 * Express middleware factory that moderates a specific text field in req.body.
 * Blocks the request if the text is not allowed, or cleans it in place.
 * @param {string} field - The body field to moderate (e.g. 'caption', 'content', 'bio').
 */
function moderateField(field) {
  const { moderateText } = require('../services/textModerator');

  return async (req, res, next) => {
    const text = req.body?.[field];
    if (!text || typeof text !== 'string') return next();

    try {
      const result = await moderateText(text);

      if (!result.allowed) {
        logModeration('text_blocked', req.user?.id, null, {
          field,
          flags: result.flags,
          original: text.substring(0, 200),
        });
        return res.status(400).json({
          error: 'Your content was blocked for violating community guidelines.',
          flags: result.flags.filter((f) => !f.includes(':review')),
        });
      }

      // Replace the field with the cleaned version
      req.body[field] = result.cleaned;

      // If it needs review, attach a flag so the controller can log it
      if (result.needsReview) {
        req._moderationReview = req._moderationReview || [];
        req._moderationReview.push({ field, flags: result.flags });
      }

      next();
    } catch (err) {
      // If moderation fails, allow through (fail-open) but log
      console.error('[Moderation] Error moderating field:', err.message);
      next();
    }
  };
}

module.exports = { requireActiveUser, moderateField };
