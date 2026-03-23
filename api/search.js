import { fetchFromUBB } from './_lib/parsers.js';

export default async function handler(req, res) {
  try {
    const { q, type } = req.query;

    if (!q || q.length < 2) {
      res.status(200).json([]);
      return;
    }

    const params = new URLSearchParams();
    params.append('search', 'plan');
    params.append('word', q);

    if (type === 'teacher' || !type) {
      params.append('conductors', '1');
    }
    if (type === 'group' || !type) {
      params.append('groups', '1');
    }
    if (type === 'room' || !type) {
      params.append('rooms', '1');
    }

    const response = await fetch('https://plany.ubb.edu.pl/right_menu_result_plan.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const html = await response.text();
    const results = parseSearchResults(html);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}

function parseSearchResults(html) {
  const results = [];
  const regex = /<a[^>]*href="plan\.php\?type=(\d+)&(?:amp;)?id=(\d+)"[^>]*>([^<]+)<\/a>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const scheduleType = match[1];
    const id = match[2];
    const name = match[3].trim();

    let resultType = 'group';
    if (scheduleType === '10') resultType = 'teacher';
    else if (scheduleType === '20') resultType = 'room';

    results.push({
      id,
      name,
      scheduleType,
      resultType,
    });
  }

  return results;
}
