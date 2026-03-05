import { fetchFromUBB } from '../../_lib/parsers.js';

export default async function handler(request, response) {
  try {
    const { type, id, week } = request.query;

    let url = `/plan.php?type=${type}&id=${id}`;
    if (week) {
      url += `&w=${week}`;
    }

    const res = await fetchFromUBB(url);
    const html = await res.text();
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.status(200).send(html);
  } catch (error) {
    console.error('Error fetching schedule HTML:', error);
    response.status(500).json({ error: 'Failed to fetch schedule HTML' });
  }
}
