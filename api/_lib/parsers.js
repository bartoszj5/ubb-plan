const UBB_BASE_URL = 'https://plany.ubb.edu.pl';

export async function fetchFromUBB(path) {
  const response = await fetch(`${UBB_BASE_URL}${path}`);
  return response;
}

export function parseFaculties(html) {
  const faculties = [];
  const regex = /branch\(1,\s*(\d+),\s*0,\s*'([^']+)'\)/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    faculties.push({
      id: match[1],
      name: match[2],
      type: 'faculty',
      hasChildren: true,
    });
  }

  return faculties;
}

export function parseTreeNodes(html, parentId) {
  const nodes = [];
  const seenIds = new Set();

  const pureBranchRegex =
    /get_left_tree_branch\(\s*'(\d+)',\s*'img_\d+',\s*'div_\d+',\s*'1',\s*'(\d+)'\s*\);\s*"\s*[^>]*>\s*([^<]+)<div/g;

  const hybridRegex =
    /get_left_tree_branch\(\s*'(\d+)',\s*'img_\d+',\s*'div_\d+',\s*'1',\s*'(\d+)'\s*\);\s*"\s*[^>]*>\s*<a[^>]*href="plan\.php\?type=(\d+)&(?:amp;)?id=(\d+)"[^>]*>([^<]+)<\/a>/g;

  const leafRegex =
    /<a[^>]*href="plan\.php\?type=(\d+)&(?:amp;)?id=(\d+)"[^>]*>([^<]+)<\/a>/g;

  let match;

  while ((match = hybridRegex.exec(html)) !== null) {
    const id = match[4];
    seenIds.add(id);
    nodes.push({
      id: id,
      name: match[5].trim(),
      type: 'schedule',
      scheduleType: match[3],
      hasChildren: match[2] === '1',
      parentId,
    });
  }

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
        parentId,
      });
    }
  }

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
        parentId,
      });
    }
  }

  return nodes;
}

function parseICSDate(dateStr) {
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(9, 11);
  const minute = dateStr.substring(11, 13);
  const second = dateStr.substring(13, 15);

  const suffix = dateStr.endsWith('Z') ? 'Z' : '';
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${suffix}`;
}

export function parseICS(icsData) {
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
