import { fetchFromUBB, parseICS } from '../../_lib/parsers.js';

export default async function handler(request, response) {
  try {
    const { type, id, week } = request.query;

    let url = `/plan.php?type=${type}&id=${id}&cvsfile=true`;
    if (week) {
      url += `&w=${week}`;
    }

    const res = await fetchFromUBB(url);
    const icsData = await res.text();
    const events = parseICS(icsData);
    response.status(200).json(events);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    response.status(500).json({ error: 'Failed to fetch schedule' });
  }
}
