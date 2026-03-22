import { fetchFromUBB, parseFaculties } from './_lib/parsers.js';

let cachedFaculties = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export default async function handler(request, response) {
  try {
    const now = Date.now();
    if (!cachedFaculties || now - cacheTimestamp > CACHE_TTL) {
      const res = await fetchFromUBB('/left_menu.php?type=1');
      const html = await res.text();
      cachedFaculties = parseFaculties(html);
      cacheTimestamp = now;
    }

    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    response.status(200).json(cachedFaculties);
  } catch (error) {
    console.error('Error fetching faculties:', error);
    response.status(500).json({ error: 'Failed to fetch faculties' });
  }
}
