import { fetchFromUBB, parseNotices } from './_lib/parsers.js';

let cachedNotices = null;
let cacheTimestamp = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export default async function handler(request, response) {
  try {
    const now = Date.now();
    if (!cachedNotices || now - cacheTimestamp > CACHE_TTL) {
      const res = await fetchFromUBB('/main.php');
      const html = await res.text();
      cachedNotices = parseNotices(html);
      cacheTimestamp = now;
    }

    response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=43200');
    response.status(200).json(cachedNotices);
  } catch (error) {
    console.error('Error fetching notices:', error);
    response.status(500).json({ error: 'Failed to fetch notices' });
  }
}
