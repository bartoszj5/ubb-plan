import { getTreeIndex } from './_lib/treeIndex.js';
import { buildSitemap } from './_lib/sitemap.js';

export default async function handler(req, res) {
  let nodes = [];
  try {
    nodes = await getTreeIndex();
  } catch (error) {
    // Still serve the home page so the sitemap never returns an error to crawlers.
    console.error('Error building sitemap:', error);
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', nodes.length
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'public, s-maxage=300');
  res.status(200).send(buildSitemap(nodes));
}
