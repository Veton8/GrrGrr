const leo = require('leo-profanity');

const MODERATION_ENABLED = process.env.MODERATION_ENABLED !== 'false';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── Layer 1: Local profanity filter (instant) ──────────────────────────────
leo.loadDictionary();

/**
 * Moderate a piece of user-generated text.
 * Layer 1: Local bad-words check (instant, blocks obvious profanity).
 * Layer 2: OpenAI Moderation API (async, detects hate/harassment/violence/etc).
 * @param {string} text - The text to moderate.
 * @returns {Promise<{allowed: boolean, cleaned: string, flags: string[], needsReview: boolean}>}
 */
async function moderateText(text) {
  if (!MODERATION_ENABLED || !text || text.trim().length === 0) {
    return { allowed: true, cleaned: text, flags: [], needsReview: false };
  }

  const flags = [];
  let needsReview = false;
  let allowed = true;

  // Layer 1: Instant profanity check
  if (leo.check(text)) {
    flags.push('profanity');
  }

  // Clean the text (replaces profanity with ***)
  const cleaned = leo.clean(text);

  // Layer 2: OpenAI Moderation API (free, async)
  if (OPENAI_API_KEY) {
    try {
      const result = await callOpenAIModeration(text);
      if (result) {
        for (const [category, score] of Object.entries(result.category_scores)) {
          if (score > 0.7) {
            flags.push(category);
            allowed = false; // Auto-block
          } else if (score > 0.4) {
            flags.push(`${category}:review`);
            needsReview = true;
          }
        }
      }
    } catch (err) {
      // If API fails, allow text but flag for review if profanity was detected
      console.warn('[TextModerator] OpenAI API error:', err.message);
      if (flags.includes('profanity')) {
        needsReview = true;
      }
    }
  } else {
    // No OpenAI key — rely on profanity filter only; flag profane text for review
    if (flags.includes('profanity')) {
      needsReview = true;
    }
  }

  return { allowed, cleaned, flags, needsReview };
}

/**
 * Call the OpenAI Moderation API.
 * @param {string} text
 * @returns {Promise<{flagged: boolean, categories: Object, category_scores: Object}|null>}
 */
async function callOpenAIModeration(text) {
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API returned ${res.status}`);
  }

  const data = await res.json();
  return data.results?.[0] || null;
}

/**
 * Quick synchronous profanity check (Layer 1 only, no API call).
 * Useful for real-time chat where latency matters.
 * @param {string} text
 * @returns {{isProfane: boolean, cleaned: string}}
 */
function quickCheck(text) {
  if (!MODERATION_ENABLED || !text) {
    return { isProfane: false, cleaned: text };
  }
  return {
    isProfane: leo.check(text),
    cleaned: leo.clean(text),
  };
}

module.exports = { moderateText, quickCheck };
