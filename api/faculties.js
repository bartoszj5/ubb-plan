import { fetchFromUBB, parseFaculties } from './_lib/parsers.js';

export default async function handler(request, response) {
  try {
    const res = await fetchFromUBB('/left_menu.php?type=1');
    const html = await res.text();
    const faculties = parseFaculties(html);
    response.status(200).json(faculties);
  } catch (error) {
    console.error('Error fetching faculties:', error);
    response.status(500).json({ error: 'Failed to fetch faculties' });
  }
}
