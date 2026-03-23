import express from 'express';
import cors from 'cors';
import {
    fetchFromUBB,
    parseFaculties,
    parseTreeNodes,
    parseGroupTitle,
    parseScheduleHTMLMeta,
    parseICS,
    fetchTeacherFullNames,
} from '../api/_lib/parsers.js';

const app = express();
const PORT = process.env.PORT || 3001;
const UBB_BASE_URL = 'https://plany.ubb.edu.pl';

app.use(cors());
app.use(express.json());

// ── Caches ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_BRANCH_CACHE = 200;

let facultiesCache = null;
let facultiesCacheTs = 0;

const branchCache = new Map();

let treeIndexCache = null;
let treeIndexCacheTs = 0;

// ── Concurrency limiter (for tree-index crawl) ─────────────────────────────

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

// ── Build full tree index ───────────────────────────────────────────────────

async function buildTreeIndex() {
    const limit = createLimiter(20);

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

        if (!node.hasChildren || depth >= 5) return;

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

// ── API Routes ──────────────────────────────────────────────────────────────

// Get initial faculties list (cached)
app.get('/api/faculties', async (req, res) => {
    try {
        const now = Date.now();
        if (!facultiesCache || now - facultiesCacheTs > CACHE_TTL) {
            const response = await fetchFromUBB('/left_menu.php?type=1');
            const html = await response.text();
            facultiesCache = parseFaculties(html);
            facultiesCacheTs = now;
        }
        res.json(facultiesCache);
    } catch (error) {
        console.error('Error fetching faculties:', error);
        res.status(500).json({ error: 'Failed to fetch faculties' });
    }
});

// Get navigation tree branches (cached per branch)
app.get('/api/tree', async (req, res) => {
    try {
        const { type = 1, branch = 0, link = 0, iPos = 0 } = req.query;
        const cacheKey = `${type}-${branch}`;
        const now = Date.now();
        const cached = branchCache.get(cacheKey);

        let nodes;
        if (cached && now - cached.timestamp < CACHE_TTL) {
            nodes = cached.data;
        } else {
            const response = await fetchFromUBB(
                `/left_menu_feed.php?type=${type}&branch=${branch}&link=${link}&iPos=${iPos}`
            );
            const html = await response.text();
            nodes = parseTreeNodes(html, branch);

            if (branchCache.size >= MAX_BRANCH_CACHE) {
                const oldest = branchCache.keys().next().value;
                branchCache.delete(oldest);
            }
            branchCache.set(cacheKey, { data: nodes, timestamp: now });
        }

        res.json(nodes);
    } catch (error) {
        console.error('Error fetching tree:', error);
        res.status(500).json({ error: 'Failed to fetch tree data' });
    }
});

// Full tree index for search (cached, built by crawling entire tree)
app.get('/api/tree-index', async (req, res) => {
    try {
        const now = Date.now();
        if (!treeIndexCache || now - treeIndexCacheTs > CACHE_TTL) {
            treeIndexCache = await buildTreeIndex();
            treeIndexCacheTs = now;
        }
        res.json(treeIndexCache);
    } catch (error) {
        console.error('Error building tree index:', error);
        res.status(500).json({ error: 'Failed to build tree index' });
    }
});

// Get schedule in ICS format with full names from legend
app.get('/api/schedule/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { week } = req.query;

        let icsUrl = `/plan.php?type=${type}&id=${id}&cvsfile=true`;
        let htmlUrl = `/plan.php?type=${type}&id=${id}&winW=2000&winH=1000`;
        if (week) {
            icsUrl += `&w=${week}`;
            htmlUrl += `&w=${week}`;
        }

        const [icsRes, htmlRes] = await Promise.all([
            fetchFromUBB(icsUrl),
            fetchFromUBB(htmlUrl),
        ]);

        const [icsData, html] = await Promise.all([
            icsRes.text(),
            htmlRes.text(),
        ]);

        const events = parseICS(icsData);
        const { subjects, teachers } = parseScheduleHTMLMeta(html);

        const teacherFullNames = await fetchTeacherFullNames(teachers);

        for (const event of events) {
            if (event.subject && subjects[event.subject]) {
                event.subjectFullName = subjects[event.subject];
            }
            if (event.teacher && teacherFullNames[event.teacher]) {
                event.teacherFullName = teacherFullNames[event.teacher];
            }
            if (event.teacher && teachers[event.teacher]) {
                event.teacherId = teachers[event.teacher];
            }
        }

        res.json(events);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

// Get group name and path from schedule page
app.get('/api/group-info/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const htmlRes = await fetchFromUBB(`/plan.php?type=${type}&id=${id}&winW=2000&winH=1000`);
        const html = await htmlRes.text();
        const info = parseGroupTitle(html, type);

        if (!info) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }

        res.json(info);
    } catch (error) {
        console.error('Error fetching group info:', error);
        res.status(500).json({ error: 'Failed to fetch group info' });
    }
});

// Get schedule HTML (for week info)
app.get('/api/schedule-html/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { week } = req.query;

        let url = `/plan.php?type=${type}&id=${id}`;
        if (week) {
            url += `&w=${week}`;
        }

        const response = await fetchFromUBB(url);
        const html = await response.text();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error('Error fetching schedule HTML:', error);
        res.status(500).json({ error: 'Failed to fetch schedule HTML' });
    }
});

// Search plans (teachers, groups, rooms)
app.get('/api/search', async (req, res) => {
    try {
        const { q, type } = req.query;

        if (!q || q.length < 2) {
            res.json([]);
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

        const response = await fetch(`${UBB_BASE_URL}/right_menu_result_plan.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        const html = await response.text();
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

            results.push({ id, name, scheduleType, resultType });
        }

        res.json(results);
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 UBB Plan Proxy Server running on http://localhost:${PORT}`);
});
