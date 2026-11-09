export const SITE_URL = 'https://ubbplan.vercel.app';

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

/** Builds sitemap XML for the home page and every group plan found in the catalogue. */
export function buildSitemap(nodes) {
  const urls = new Set([`${SITE_URL}/`]);
  for (const node of nodes) {
    if (node.type !== 'schedule' || !node.scheduleType || !/^\d+$/.test(node.scheduleType) || !/^\d+$/.test(node.id)) continue;
    urls.add(`${SITE_URL}/plan/${node.scheduleType}/${node.id}`);
  }
  const entries = [...urls].map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
