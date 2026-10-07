const UBB_BASE_URL = "https://plany.ubb.edu.pl";

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
      type: "faculty",
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
      type: "schedule",
      scheduleType: match[3],
      hasChildren: match[2] === "1",
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
        type: "branch",
        isLeaf: match[2] === "1",
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
        type: "schedule",
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

  const suffix = dateStr.endsWith("Z") ? "Z" : "";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${suffix}`;
}

export function parseGroupTitle(html, type) {
  // Extracts group title from: <div class=title ...>Grupy \ Wydział ... \ GroupName</div>
  const match = html.match(/class=["']?title["']?[^>]*>\s*(.*?)\s*<\/div>/);
  if (!match) return null;
  const raw = match[1].trim();
  // Path segments separated by " \ "
  const parts = raw.split(/\s*\\\s*/);
  // First part is the type label (e.g. "Grupy", "Prowadzący"), skip it
  const path = parts.slice(1);
  let name = path.length > 0 ? path[path.length - 1] : raw;

  // For teacher pages (type=10), extract the actual name from the heading
  if (String(type) === '10') {
    const teacherMatch = html.match(/Plan zaj[^-]*-\s*([^,<]+)/);
    if (teacherMatch) {
      name = teacherMatch[1].trim();
    }
  }

  return { name, path };
}

export function parseScheduleHTMLMeta(html, scheduleType = '0') {
  const subjects = {};
  const teachers = {};
  const entries = [];

  // UBB also renders notices as courses, but without a lesson type.
  const courseRegex = /<div\b[^>]*\bid="course_\d+"[^>]*>([\s\S]*?)<\/div>/g;
  let course;
  while ((course = courseRegex.exec(html)) !== null) {
    const content = course[1].replace(/<img\b[^>]*>/gi, '');
    const heading = decodeHTMLText(content.split(/<br\s*\/?\s*>/i)[0]);
    const typedHeading = heading.match(/^(.*),\s*(wyk|ćw|cw|lab|sem|lek|proj|konw|wykład|ćwiczenia|laboratorium|seminarium|lektorat|projekt|konwersatorium)\.?$/iu);
    const links = [...content.matchAll(/<a[^>]*href="plan\.php\?type=(\d+)&(?:amp;)?id=\d+"[^>]*>([^<]+)<\/a>/g)];
    entries.push({
      subject: typedHeading ? typedHeading[1].trim() : heading,
      type: typedHeading ? typedHeading[2].trim() : '',
      teacher: links.filter(link => link[1] === (String(scheduleType) === '10' ? '0' : '10')).map(link => decodeHTMLText(link[2])).join(' '),
      room: links.filter(link => link[1] === (String(scheduleType) === '20' ? '0' : '20')).map(link => decodeHTMLText(link[2])).join(' '),
      isNotice: !typedHeading,
    });
  }

  // Parse legend: <strong>Am</strong> - Analiza macierzowa, występowanie: ...
  const subjectRegex = /<strong>([^<]+)<\/strong>\s*-\s*([^,<]+)/g;
  let match;
  while ((match = subjectRegex.exec(html)) !== null) {
    const abbr = match[1].trim();
    const fullName = match[2].trim();
    subjects[abbr] = fullName;
  }

  // teachers maps abbreviation -> id
  const teacherRegex =
    /<a[^>]*href="plan\.php\?type=10&(?:amp;)?id=(\d+)"[^>]*>([^<]+)<\/a>/g;
  while ((match = teacherRegex.exec(html)) !== null) {
    const id = match[1];
    const abbr = match[2].trim();
    if (!teachers[abbr]) {
      teachers[abbr] = id;
    }
  }

  return { subjects, teachers, entries };
}

function decodeHTMLText(text) {
  return text.replace(/<[^>]*>/g, '').replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, decimal, hex, name) => {
    if (decimal || hex) {
      const code = parseInt(decimal || hex, hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[name.toLowerCase()] ?? entity;
  }).trim();
}

// Only merge a notice when its time and teacher identify one lesson.
// Ambiguous or standalone notices remain visible as separate entries.
export function attachScheduleNotices(events) {
  const lessons = events.filter(event => event.kind !== 'notice');
  const attached = new Set();

  for (const notice of events.filter(event => event.kind === 'notice')) {
    const candidates = lessons.filter(event =>
      new Date(event.start) < new Date(notice.end) &&
      new Date(notice.start) < new Date(event.end) &&
      notice.teacher && notice.teacher.split(/\s+/).some(teacher => event.teacher.split(/\s+/).includes(teacher))
    );
    if (candidates.length !== 1) continue;
    const lesson = candidates[0];
    lesson.notices ??= [];
    lesson.notices.push({ text: notice.subject, teacher: notice.teacher, room: notice.room });
    attached.add(notice);
  }

  return events.filter(event => !attached.has(event));
}

const teacherNameCache = new Map();

export async function fetchTeacherFullNames(teacherMap) {
  const entries = Object.entries(teacherMap);
  if (entries.length === 0) return {};

  const results = {};
  await Promise.all(
    entries.map(async ([abbr, id]) => {
      if (teacherNameCache.has(abbr)) {
        results[abbr] = teacherNameCache.get(abbr);
        return;
      }
      try {
        const res = await fetch(
          `https://plany.ubb.edu.pl/plan.php?type=10&id=${id}&winW=2000&winH=1000`,
        );
        const html = await res.text();
        const titleMatch = html.match(/Plan zaj[^-]*-\s*([^,<]+)/);
        if (titleMatch) {
          const fullName = titleMatch[1].trim();
          results[abbr] = fullName;
          teacherNameCache.set(abbr, fullName);
        }
      } catch {
        // Keep abbreviation if fetch fails
      }
    }),
  );
  return results;
}

export function parseNotices(html) {
  const notices = [];

  // Match "Uwaga do planów dla studiów stacjonarnych" section
  const stacjonarneMatch = html.match(
    /<b>Uwaga do planów dla studiów stacjonarnych[^<]*<\/b>\s*([\s\S]*?)(?=<br>\s*<br>\s*<b>Uwaga|<!-- ten tekst)/
  );
  if (stacjonarneMatch) {
    const block = stacjonarneMatch[0];
    const titleMatch = block.match(/<b>(Uwaga do planów dla studiów stacjonarnych[^<]*)<\/b>/);
    const title = titleMatch ? titleMatch[1].replace(/,\s*$/, '').trim() : 'Studia stacjonarne';
    const descMatch = block.match(/<\/b>\s*([^<]+)/);
    const description = descMatch ? descMatch[1].trim().replace(/:\s*$/, '') : '';
    const items = [];
    const liRegex = /<li>(?:<b>([^<]*)<\/b>)?\s*(.*?)<\/li>/g;
    let m;
    while ((m = liRegex.exec(block)) !== null) {
      const bold = m[1] ? m[1].trim() : '';
      const rest = m[2] ? m[2].trim().replace(/[,;]\s*$/, '') : '';
      items.push(bold ? `${bold} ${rest}` : rest);
    }
    notices.push({ title, description, items });
  }

  // Match "Uwaga do planów dla studiów zaocznych" section
  const zaoczneMatch = html.match(
    /<b>Uwaga do planów dla studiów zaocznych[^<]*<\/b>\s*([\s\S]*?)(?=Brakujące|<!-- ten tekst)/
  );
  if (zaoczneMatch) {
    const block = zaoczneMatch[0];
    const title = 'Uwaga do planów dla studiów zaocznych';
    // Get description text between </b> and first <li>
    const descMatch = block.match(/<\/b>\s*(?:<br>)?\s*([\s\S]*?)(?=<li>)/);
    const description = descMatch
      ? descMatch[1].replace(/<br>/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    const items = [];
    const liRegex = /<li>\s*(.*?)<\/li>/g;
    let m;
    while ((m = liRegex.exec(block)) !== null) {
      items.push(m[1].trim().replace(/[,;]\s*$/, ''));
    }
    notices.push({ title, description, items });
  }

  return notices;
}

export function parseICS(icsData, entries = []) {
  const events = [];
  const eventBlocks = icsData.replace(/\r?\n[ \t]/g, '').split("BEGIN:VEVENT").slice(1);
  const normalize = text => text.trim().replace(/\s+/g, ' ');
  const entriesBySummary = new Map(entries.map(entry => [
    normalize(`${entry.subject} ${entry.type} ${entry.teacher} ${entry.room}`), entry,
  ]));
  const decodeICSText = text => text.trim().replace(/\\([nN,;\\])/g, (_, char) => /n/i.test(char) ? '\n' : char);

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
      const summaryText = decodeICSText(summary[1]);
      event.summary = summaryText;

      const entry = entriesBySummary.get(normalize(summaryText));
      const parts = summaryText.split(/\s+/);
      if (entry) {
        event.subject = entry.subject;
        event.type = entry.type;
        event.teacher = entry.teacher;
        event.room = entry.room;
        if (entry.isNotice) event.kind = 'notice';
      } else if (parts.length >= 1) {
        event.subject = parts[0];
        event.type = parts[1] || "";
        event.teacher = parts[2] || "";
        event.room = parts.slice(3).join(" ") || "";
      }
    }
    if (location) {
      event.location = decodeICSText(location[1]);
    }
    if (description) {
      event.description = decodeICSText(description[1]);
    }

    if (event.start) {
      events.push(event);
    }
  }

  return events;
}
