import { sendUBBError } from '../../_lib/ubb.js';
import { fetchFromUBB, parseICS, parseScheduleHTMLMeta, fetchTeacherFullNames, attachScheduleNotices } from '../../_lib/parsers.js';

export default async function handler(request, response) {
  try {
    const { type, id, week, refresh } = request.query;

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

    const { subjects, teachers, entries } = parseScheduleHTMLMeta(html, type);
    const events = attachScheduleNotices(parseICS(icsData, entries));

    // Fetch teacher full names in parallel
    const teacherFullNames = await fetchTeacherFullNames(teachers);

    // Enrich events with full names and teacher IDs
    for (const event of events) {
      if (event.teacherPlans) {
        event.teacherPlans = event.teacherPlans.map(plan => ({
          ...plan,
          name: teacherFullNames[plan.name] || plan.name,
        }));
      }
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

    response.setHeader('X-UBB-Fetched-At', String(Date.now()));
    response.setHeader('Cache-Control', refresh ? 'no-store' : 'public, s-maxage=300, stale-while-revalidate=600');
    response.status(200).json(events);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    sendUBBError(response, error, 'Failed to fetch schedule');
  }
}
