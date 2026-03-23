import { fetchFromUBB, parseGroupTitle } from '../../_lib/parsers.js';

export default async function handler(request, response) {
  try {
    const { type, id } = request.query;

    const htmlRes = await fetchFromUBB(`/plan.php?type=${type}&id=${id}&winW=2000&winH=1000`);
    const html = await htmlRes.text();
    const info = parseGroupTitle(html, type);

    if (!info) {
      response.status(404).json({ error: 'Group not found' });
      return;
    }

    response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    response.status(200).json(info);
  } catch (error) {
    console.error('Error fetching group info:', error);
    response.status(500).json({ error: 'Failed to fetch group info' });
  }
}
