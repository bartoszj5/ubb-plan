import './ScheduleLoader.css';

export default function ScheduleLoader() {
  return <div className="schedule-loader">
    <div className="schedule-loader-calendar" aria-hidden="true">
      <div className="schedule-loader-binding"><i /><i /></div>
      <div className="schedule-loader-heading"><span /><span /><span /><span /><span /></div>
      <div className="schedule-loader-grid">
        <span className="schedule-loader-lesson lesson-one" />
        <span className="schedule-loader-lesson lesson-two" />
        <span className="schedule-loader-lesson lesson-three" />
        <span className="schedule-loader-lesson lesson-four" />
        <span className="schedule-loader-lesson lesson-five" />
        <span className="schedule-loader-lesson lesson-six" />
      </div>
    </div>
    <p className="schedule-loader-title">Wczytywanie planu<span aria-hidden="true">…</span></p>
    <p className="schedule-loader-caption">Pobieramy zajęcia z UBB</p>
  </div>;
}
