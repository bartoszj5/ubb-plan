import { fetchFromUBB, parseTreeNodes } from './_lib/parsers.js';

const branchCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 200;

export default async function handler(request, response) {
  try {
    const { type = 1, branch = 0, link = 0, iPos = 0 } = request.query;
    const cacheKey = `${type}-${branch}`;
    const now = Date.now();
    const cached = branchCache.get(cacheKey);

    let nodes;
    if (cached && now - cached.timestamp < CACHE_TTL) {
      nodes = cached.data;
    } else {
      const res = await fetchFromUBB(
        `/left_menu_feed.php?type=${type}&branch=${branch}&link=${link}&iPos=${iPos}`
      );
      const html = await res.text();
      nodes = parseTreeNodes(html, branch);

      if (branchCache.size >= MAX_CACHE_ENTRIES) {
        const oldest = branchCache.keys().next().value;
        branchCache.delete(oldest);
      }
      branchCache.set(cacheKey, { data: nodes, timestamp: now });
    }

    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    response.status(200).json(nodes);
  } catch (error) {
    console.error('Error fetching tree:', error);
    response.status(500).json({ error: 'Failed to fetch tree data' });
  }
}
