import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const UBB_BASE_URL = 'https://plany.ubb.edu.pl';

app.use(cors());
app.use(express.json());

// Helper function to fetch from UBB
async function fetchFromUBB(path) {
    const response = await fetch(`${UBB_BASE_URL}${path}`);
    return response;
}

// Get navigation tree branches
app.get('/api/tree', async (req, res) => {
    try {
        const { type = 1, branch = 0, link = 0, iPos = 0 } = req.query;
        const response = await fetchFromUBB(
            `/left_menu_feed.php?type=${type}&branch=${branch}&link=${link}&iPos=${iPos}`
        );
        const html = await response.text();

        // Parse the HTML response to extract tree nodes
        const nodes = parseTreeNodes(html, branch);
        res.json(nodes);
    } catch (error) {
        console.error('Error fetching tree:', error);
        res.status(500).json({ error: 'Failed to fetch tree data' });
    }
});

// Get initial faculties list
app.get('/api/faculties', async (req, res) => {
    try {
        const response = await fetchFromUBB('/left_menu.php?type=1');
        const html = await response.text();
        const faculties = parseFaculties(html);
        res.json(faculties);
    } catch (error) {
        console.error('Error fetching faculties:', error);
        res.status(500).json({ error: 'Failed to fetch faculties' });
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

        // Fetch ICS and HTML in parallel
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

        // Fetch teacher full names in parallel
        const teacherFullNames = await fetchTeacherFullNames(teachers);

        // Enrich events with full names
        for (const event of events) {
            if (event.subject && subjects[event.subject]) {
                event.subjectFullName = subjects[event.subject];
            }
            if (event.teacher && teacherFullNames[event.teacher]) {
                event.teacherFullName = teacherFullNames[event.teacher];
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
        const info = parseGroupTitle(html);

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
        res.send(html);
    } catch (error) {
        console.error('Error fetching schedule HTML:', error);
        res.status(500).json({ error: 'Failed to fetch schedule HTML' });
    }
});

// Parse group title from schedule HTML page
function parseGroupTitle(html) {
    const match = html.match(/class=["']?title["']?[^>]*>\s*(.*?)\s*<\/div>/);
    if (!match) return null;
    const raw = match[1].trim();
    const parts = raw.split(/\s*\\\s*/);
    const path = parts.slice(1);
    const name = path.length > 0 ? path[path.length - 1] : raw;
    return { name, path };
}

// Parse subject and teacher info from schedule HTML page
function parseScheduleHTMLMeta(html) {
    const subjects = {};
    const teachers = {};

    const subjectRegex = /<strong>([^<]+)<\/strong>\s*-\s*([^,<]+)/g;
    let match;
    while ((match = subjectRegex.exec(html)) !== null) {
        const abbr = match[1].trim();
        const fullName = match[2].trim();
        subjects[abbr] = fullName;
    }

    const teacherRegex = /<a[^>]*href="plan\.php\?type=10&(?:amp;)?id=(\d+)"[^>]*>([^<]+)<\/a>/g;
    while ((match = teacherRegex.exec(html)) !== null) {
        const id = match[1];
        const abbr = match[2].trim();
        if (!teachers[abbr]) {
            teachers[abbr] = id;
        }
    }

    return { subjects, teachers };
}

async function fetchTeacherFullNames(teacherMap) {
    const entries = Object.entries(teacherMap);
    if (entries.length === 0) return {};

    const results = {};
    await Promise.all(
        entries.map(async ([abbr, id]) => {
            try {
                const res = await fetch(`${UBB_BASE_URL}/plan.php?type=10&id=${id}&winW=2000&winH=1000`);
                const html = await res.text();
                const titleMatch = html.match(/Plan zaj[^-]*-\s*([^,<]+)/);
                if (titleMatch) {
                    results[abbr] = titleMatch[1].trim();
                }
            } catch {
                // Keep abbreviation if fetch fails
            }
        })
    );
    return results;
}

// Parse faculties from left_menu.php HTML
function parseFaculties(html) {
    const faculties = [];
    // Match: branch(1, ID, 0, 'NAME')
    const regex = /branch\(1,\s*(\d+),\s*0,\s*'([^']+)'\)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        faculties.push({
            id: match[1],
            name: match[2],
            type: 'faculty',
            hasChildren: true
        });
    }

    return faculties;
}

// Parse tree nodes from left_menu_feed.php
function parseTreeNodes(html, parentId) {
    const nodes = [];
    const seenIds = new Set();

    // Case 1: Pure branch - get_left_tree_branch followed by plain text (no link)
    // Format: onclick=" get_left_tree_branch( 'ID', ... ); " >  NAME<div
    const pureBranchRegex = /get_left_tree_branch\(\s*'(\d+)',\s*'img_\d+',\s*'div_\d+',\s*'1',\s*'(\d+)'\s*\);\s*"\s*[^>]*>\s*([^<]+)<div/g;

    // Case 2: Hybrid node - get_left_tree_branch AND a link inside
    // Format: onclick=" get_left_tree_branch( 'ID', ... ); " >  <a href="plan.php?type=TYPE&id=ID">NAME</a><div
    const hybridRegex = /get_left_tree_branch\(\s*'(\d+)',\s*'img_\d+',\s*'div_\d+',\s*'1',\s*'(\d+)'\s*\);\s*"\s*[^>]*>\s*<a[^>]*href="plan\.php\?type=(\d+)&(?:amp;)?id=(\d+)"[^>]*>([^<]+)<\/a>/g;

    // Case 3: Pure link (leaf) - just a link without get_left_tree_branch in parent context
    // We'll collect all links and filter out those already captured as hybrid
    const leafRegex = /<a[^>]*href="plan\.php\?type=(\d+)&(?:amp;)?id=(\d+)"[^>]*>([^<]+)<\/a>/g;

    let match;

    // First pass: find hybrid nodes (expandable with links)
    while ((match = hybridRegex.exec(html)) !== null) {
        const id = match[4]; // ID from the link
        seenIds.add(id);
        nodes.push({
            id: id,
            name: match[5].trim(),
            type: 'schedule', // It's a schedule (has link)
            scheduleType: match[3],
            hasChildren: match[2] === '1', // Can also be expanded
            parentId
        });
    }

    // Second pass: find pure branches (no link)
    while ((match = pureBranchRegex.exec(html)) !== null) {
        const id = match[1];
        if (!seenIds.has(id)) {
            seenIds.add(id);
            nodes.push({
                id: id,
                name: match[3].trim(),
                type: 'branch',
                isLeaf: match[2] === '1',
                hasChildren: true,
                parentId
            });
        }
    }

    // Third pass: find standalone links (pure leaf nodes not already captured)
    while ((match = leafRegex.exec(html)) !== null) {
        const id = match[2];
        if (!seenIds.has(id)) {
            seenIds.add(id);
            nodes.push({
                id: id,
                name: match[3].trim(),
                type: 'schedule',
                scheduleType: match[1],
                hasChildren: false,
                parentId
            });
        }
    }

    return nodes;
}

// Parse ICS format to JSON events
function parseICS(icsData) {
    const events = [];
    const eventBlocks = icsData.split('BEGIN:VEVENT').slice(1);

    for (const block of eventBlocks) {
        const event = {};

        const dtstart = block.match(/DTSTART:(\d{8}T\d{6}Z?)/);
        const dtend = block.match(/DTEND:(\d{8}T\d{6}Z?)/);
        const summary = block.match(/SUMMARY:(.+)/);
        const location = block.match(/LOCATION:(.+)/);
        const description = block.match(/DESCRIPTION:(.+)/);

        if (dtstart) {
            event.start = parseICSDate(dtstart[1]);
        }
        if (dtend) {
            event.end = parseICSDate(dtend[1]);
        }
        if (summary) {
            const summaryText = summary[1].trim();
            event.summary = summaryText;

            // Parse summary: "Subject Type Teacher Room"
            const parts = summaryText.split(' ');
            if (parts.length >= 1) {
                event.subject = parts[0];
                event.type = parts[1] || '';
                event.teacher = parts[2] || '';
                event.room = parts.slice(3).join(' ') || '';
            }
        }
        if (location) {
            event.location = location[1].trim();
        }
        if (description) {
            event.description = description[1].trim();
        }

        if (event.start) {
            events.push(event);
        }
    }

    return events;
}

// Parse ICS date format (20250930T074500Z) to ISO string
function parseICSDate(dateStr) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const minute = dateStr.substring(11, 13);
    const second = dateStr.substring(13, 15);

    // Preserve Z suffix so the browser correctly converts UTC to local time
    const suffix = dateStr.endsWith('Z') ? 'Z' : '';
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${suffix}`;
}

app.listen(PORT, () => {
    console.log(`🚀 UBB Plan Proxy Server running on http://localhost:${PORT}`);
});
