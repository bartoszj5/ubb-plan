import { fetchFromUBB, parseTreeNodes } from './_lib/parsers.js';

export default async function handler(request, response) {
  try {
    const { type = 1, branch = 0, link = 0, iPos = 0 } = request.query;
    const res = await fetchFromUBB(
      `/left_menu_feed.php?type=${type}&branch=${branch}&link=${link}&iPos=${iPos}`
    );
    const html = await res.text();
    const nodes = parseTreeNodes(html, branch);
    response.status(200).json(nodes);
  } catch (error) {
    console.error('Error fetching tree:', error);
    response.status(500).json({ error: 'Failed to fetch tree data' });
  }
}
