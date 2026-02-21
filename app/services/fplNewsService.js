// app/services/fplNewsService.js
// Fetches injury/status news from FPL Official API (bootstrap-static)

import { cacheService } from './cacheService.js';

const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const CACHE_KEY = 'fpl-news-data';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch FPL bootstrap-static and extract news data.
 * Returns an object keyed by FPL element ID with news fields, or null on failure.
 */
export async function fetchFPLNewsData() {
  const cached = cacheService.get(CACHE_KEY);
  if (cached && cached.newsMap) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 FPL News: Returning cached data');
    }
    return cached.newsMap;
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 FPL News: Fetching bootstrap-static...');
    }

    const response = await fetch(FPL_BOOTSTRAP_URL, {
      cache: 'no-store',
      headers: { 'User-Agent': 'FPL-Dashboard/1.0' }
    });

    if (!response.ok) {
      throw new Error(`FPL API returned ${response.status}`);
    }

    const data = await response.json();
    const elements = data.elements || [];

    const newsMap = {};
    let newsCount = 0;

    elements.forEach(el => {
      newsMap[el.id] = {
        fpl_status: el.status,
        fpl_news: el.news || '',
        fpl_news_added: el.news_added || null,
        fpl_chance_this_round: el.chance_of_playing_this_round,
        fpl_chance_next_round: el.chance_of_playing_next_round,
        // Official FPL model's own expected points — independent of FFH, useful for blending
        ep_next: el.ep_next ? parseFloat(el.ep_next) : null,
        ep_this: el.ep_this ? parseFloat(el.ep_this) : null,
      };
      if (el.news && el.news.trim() !== '') newsCount++;
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ FPL News: ${elements.length} players loaded, ${newsCount} with active news`);
    }

    cacheService.set(CACHE_KEY, { newsMap }, CACHE_TTL);
    return newsMap;
  } catch (error) {
    console.error('❌ FPL News fetch failed (graceful fallback):', error.message);
    return null;
  }
}
