import { fetchFromUBB, parseFaculties, parseTreeNodes } from './parsers.js';

const MAX_DEPTH = 5;
const CONCURRENCY = 20;
const CACHE_TTL = 60 * 60 * 1000;

let cachedIndex = null;
let cacheTimestamp = 0;

function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        active++;
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          active--;
          if (queue.length > 0) queue.shift()();
        }
      };

      if (active < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

async function buildIndex() {
  const limit = createLimiter(CONCURRENCY);

  const facRes = await fetchFromUBB('/left_menu.php?type=1');
  const facHtml = await facRes.text();
  const faculties = parseFaculties(facHtml);

  const allNodes = [];

  async function crawlNode(node, path, depth) {
    allNodes.push({
      id: node.id,
      name: node.name,
      type: node.type,
      scheduleType: node.scheduleType || null,
      hasChildren: node.hasChildren,
      path,
    });

    if (!node.hasChildren || depth >= MAX_DEPTH) return;

    try {
      const children = await limit(async () => {
        const res = await fetchFromUBB(
          `/left_menu_feed.php?type=1&branch=${node.id}&link=0&iPos=0`
        );
        const html = await res.text();
        return parseTreeNodes(html, node.id);
      });

      await Promise.all(
        children.map(child =>
          crawlNode(child, [...path, child.name], depth + 1)
        )
      );
    } catch {
      // Skip failed branches silently
    }
  }

  await Promise.all(
    faculties.map(fac => crawlNode(fac, [fac.name], 1))
  );

  return allNodes;
}

/** Full catalogue of faculties, branches and group plans, cached per instance for an hour. */
export async function getTreeIndex() {
  const now = Date.now();
  if (!cachedIndex || now - cacheTimestamp > CACHE_TTL) {
    cachedIndex = await buildIndex();
    cacheTimestamp = now;
  }
  return cachedIndex;
}
