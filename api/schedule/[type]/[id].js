import { fetchFromUBB, parseICS, parseScheduleHTMLMeta, fetchTeacherFullNames } from '../../_lib/parsers.js';

export default async function handler(request, response) {
  try {
    const { type, id, week } = request.query;

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

    response.status(200).json(events);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    response.status(500).json({ error: 'Failed to fetch schedule' });
  }
}
