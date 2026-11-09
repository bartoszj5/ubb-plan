import { sendUBBError } from './_lib/ubb.js';
import { getTreeIndex } from './_lib/treeIndex.js';

export default async function handler(req, res) {
  try {
    const index = await getTreeIndex();
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json(index);
  } catch (error) {
    console.error('Error building tree index:', error);
    sendUBBError(res, error, 'Failed to build tree index');
  }
}
