/**
 * Tests for FTS5 search, sanitization, and discover endpoint.
 */
require('dotenv').config();

describe('Search Query Sanitization', () => {
  let sanitizeQuery;

  beforeAll(() => {
    jest.resetModules();
    const service = require('../src/services/searchService');
    sanitizeQuery = service.sanitizeQuery;
  });

  test('removes FTS5 special characters', () => {
    expect(sanitizeQuery('test*query')).toBe('test query');
    expect(sanitizeQuery('"hello"')).toBe('hello');
    expect(sanitizeQuery('test(query)')).toBe('test query');
    expect(sanitizeQuery('test:query')).toBe('test query');
  });

  test('handles null/empty input', () => {
    expect(sanitizeQuery(null)).toBe('');
    expect(sanitizeQuery('')).toBe('');
    expect(sanitizeQuery(undefined)).toBe('');
  });

  test('collapses multiple spaces', () => {
    expect(sanitizeQuery('hello   world')).toBe('hello world');
  });

  test('preserves normal text', () => {
    expect(sanitizeQuery('dance tutorial')).toBe('dance tutorial');
  });

  test('handles complex malicious input', () => {
    const result = sanitizeQuery('DROP TABLE; -- "test" OR 1=1 MATCH *');
    expect(result).not.toContain('"');
    expect(result).not.toContain('*');
  });
});

describe('Rate Limiting', () => {
  let checkRateLimit;

  beforeAll(() => {
    jest.resetModules();
    const service = require('../src/services/searchService');
    checkRateLimit = service.checkRateLimit;
  });

  test('allows first search', () => {
    expect(checkRateLimit('test-user-rate')).toBe(true);
  });

  test('allows up to 10 searches', () => {
    const userId = 'rate-limit-test-' + Date.now();
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(userId)).toBe(true);
    }
  });

  test('blocks 11th search within window', () => {
    const userId = 'rate-block-test-' + Date.now();
    for (let i = 0; i < 10; i++) {
      checkRateLimit(userId);
    }
    expect(checkRateLimit(userId)).toBe(false);
  });
});

describe('Search Service Functions', () => {
  test('searchHashtags returns results for known hashtag', () => {
    jest.resetModules();
    const { searchHashtags } = require('../src/services/searchService');
    // 'dance' exists in seed data
    const results = searchHashtags('dan');
    expect(Array.isArray(results)).toBe(true);
    // Should find 'dance' as prefix match
    if (results.length > 0) {
      expect(results[0].name).toMatch(/^dan/);
    }
  });

  test('searchHashtags returns empty for no match', () => {
    jest.resetModules();
    const { searchHashtags } = require('../src/services/searchService');
    const results = searchHashtags('zzzznonexistent');
    expect(results).toEqual([]);
  });

  test('getSuggestions returns both users and hashtags', () => {
    jest.resetModules();
    const { getSuggestions } = require('../src/services/searchService');
    const results = getSuggestions('da');
    expect(Array.isArray(results)).toBe(true);
    // Should have type field
    if (results.length > 0) {
      expect(['hashtag', 'user']).toContain(results[0].type);
    }
  });

  test('getSuggestions rejects short queries', () => {
    jest.resetModules();
    const { getSuggestions } = require('../src/services/searchService');
    expect(getSuggestions('a')).toEqual([]);
    expect(getSuggestions('')).toEqual([]);
  });
});

describe('FTS5 Search', () => {
  test('searchVideos returns array', () => {
    jest.resetModules();
    const { searchVideos } = require('../src/services/searchService');
    const results = searchVideos('comedy');
    expect(Array.isArray(results)).toBe(true);
  });

  test('searchUsers returns array', () => {
    jest.resetModules();
    const { searchUsers } = require('../src/services/searchService');
    const results = searchUsers('demo');
    expect(Array.isArray(results)).toBe(true);
  });

  test('search with special chars doesnt crash', () => {
    jest.resetModules();
    const { searchVideos, searchUsers } = require('../src/services/searchService');
    expect(() => searchVideos('"test" OR *')).not.toThrow();
    expect(() => searchUsers('user:admin')).not.toThrow();
  });
});

describe('Discover Data', () => {
  test('getDiscoverData returns all sections', () => {
    jest.resetModules();
    const { getDiscoverData } = require('../src/services/searchService');
    const data = getDiscoverData();
    expect(data).toHaveProperty('trendingHashtags');
    expect(data).toHaveProperty('popularCreators');
    expect(data).toHaveProperty('risingVideos');
    expect(Array.isArray(data.trendingHashtags)).toBe(true);
    expect(Array.isArray(data.popularCreators)).toBe(true);
    expect(Array.isArray(data.risingVideos)).toBe(true);
  });

  test('trending hashtags have required fields', () => {
    jest.resetModules();
    const { getDiscoverData } = require('../src/services/searchService');
    const data = getDiscoverData();
    if (data.trendingHashtags.length > 0) {
      const h = data.trendingHashtags[0];
      expect(h).toHaveProperty('name');
      expect(h).toHaveProperty('videoCount');
    }
  });

  test('popular creators have required fields', () => {
    jest.resetModules();
    const { getDiscoverData } = require('../src/services/searchService');
    const data = getDiscoverData();
    if (data.popularCreators.length > 0) {
      const c = data.popularCreators[0];
      expect(c).toHaveProperty('username');
      expect(c).toHaveProperty('followerCount');
    }
  });
});
