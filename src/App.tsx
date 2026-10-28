import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import TreeView from './components/TreeView';
import ScheduleGrid from './components/ScheduleGrid';
import Favorites from './components/Favorites';
import CommandPalette from './components/CommandPalette';
import PlanSearch from './components/PlanSearch';
import Dialog from './components/Dialog';
import { SunIcon, MoonIcon, BookOpenIcon, CalendarIcon, StarIcon, SearchIcon, ChevronRightIcon, InfoIcon, ClockIcon } from './components/Icons';
import type { FavoriteGroup, MobileScheduleView } from './types';
import type { SearchKind } from './utils/search';
import { fetchSchedule, fetchGroupInfo, SCHEDULE_CACHE_TTL } from './utils/api';
import type { ScheduleData } from './utils/api';
import { getFavorites, addFavorite, removeFavorite } from './utils/favorites';
import { saveGroupMeta, getGroupMeta } from './utils/groupMeta';
import { getMyPlan, setMyPlan, getRecentPlans, recordRecentPlan, planKey, PLANS_CHANGED, getPlanPresentation, getPlanView, savePlanView } from './utils/plans';
import { addDays, dateKey, getWeekStart, getUBBWeekNumber } from './utils/schedule';
import { readStorage, writeStorage } from './utils/storage';
import { useMediaQuery } from './hooks/useMediaQuery';
import Notices from './components/Notices';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import './App.css';

interface Library { favorites: FavoriteGroup[]; recent: FavoriteGroup[]; myPlan: FavoriteGroup | null }
function readLibrary(): Library { return { favorites: getFavorites(), recent: getRecentPlans(), myPlan: getMyPlan() }; }

function WelcomeScreen({ library, onSelect, onBrowse }: { library: Library; onSelect: (plan: FavoriteGroup) => void; onBrowse: () => void }) {
  if (library.myPlan) return <Navigate to={`/plan/${library.myPlan.scheduleType}/${library.myPlan.id}`} replace />;
  return <div className="welcome-screen"><div className="welcome-content">
    <div className="welcome-mark"><CalendarIcon size={28} /></div><h1>Znajdź swój plan.</h1>
    <p>Twoja grupa, prowadzący lub sala. Wszystko w jednym miejscu.</p>
    <PlanSearch onSelect={onSelect} favorites={library.favorites} recent={library.recent} />
    <button type="button" className="browse-button" onClick={onBrowse}><BookOpenIcon size={18} />Wybierz po wydziale<ChevronRightIcon size={17} /></button>
  </div></div>;
}

interface SchedulePageProps { type: string; id: string; library: Library; onSearch: () => void; onReturn: (plan: FavoriteGroup) => void; targetDate?: string }
function SchedulePage({ type, id, library, onSearch, onReturn, targetDate }: SchedulePageProps) {
  const key = `${type}:${id}`;
  const [initialView] = useState(() => {
    const date = targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? new Date(`${targetDate}T00:00:00`) : null;
    return date && Number.isFinite(+date) ? { weekStart: dateKey(getWeekStart(date)), day: (date.getDay() + 6) % 7, scrollTop: 0 } : getPlanView(key);
  });
  const [weekStart, setWeekStart] = useState(() => initialView ? getWeekStart(new Date(`${initialView.weekStart}T00:00:00`)) : getWeekStart(new Date()));
  const [mobileView, setMobileView] = useState<MobileScheduleView>(() => ({ weekStartTime: weekStart.getTime(), day: initialView?.day ?? (new Date().getDay() + 6) % 7 }));
  const [meta, setMeta] = useState(() => getGroupMeta(id, type));
  const [schedule, setSchedule] = useState<(ScheduleData & { key: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const scheduleKey = `${key}:${getUBBWeekNumber(weekStart)}`;
  const currentSchedule = schedule?.key === scheduleKey ? schedule : null;
  const groupName = meta?.name ?? id;
  const groupPath = meta?.path ?? [];
  const favorite = library.favorites.find(p => planKey(p) === key);
  const currentPlan: FavoriteGroup = { id, scheduleType: type, name: groupName, path: groupPath };

  useEffect(() => {
    const cached = getGroupMeta(id, type);
    if (cached && !(cached.path.length <= 2 && cached.path[0] === 'Grupy')) return;
    const controller = new AbortController();
    fetchGroupInfo(type, id, controller.signal).then(info => {
      if (controller.signal.aborted) return;
      const resolved = { ...info, type };
      saveGroupMeta(id, resolved); setMeta(resolved);
    }).catch(() => { /* The schedule remains usable when its title cannot be resolved. */ });
    return () => controller.abort();
  }, [id, type]);

  useEffect(() => {
    if (!meta) return;
    const plan = { id, scheduleType: type, name: meta.name, path: meta.path };
    recordRecentPlan(plan);
    if (getFavorites().some(item => planKey(item) === key)) addFavorite(plan);
    const own = getMyPlan();
    if (own && planKey(own) === key && (own.name !== meta.name || JSON.stringify(own.path) !== JSON.stringify(meta.path))) setMyPlan({ ...own, ...plan });
  }, [id, type, meta, key]);

  const loadSchedule = useCallback(async (forceRefresh = false) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null);
    try {
      const data = await fetchSchedule(type, id, getUBBWeekNumber(weekStart), { signal: controller.signal, forceRefresh });
      if (!controller.signal.aborted) setSchedule({ ...data, key: scheduleKey });
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Nie udało się pobrać planu.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [type, id, weekStart, scheduleKey]);

  useEffect(() => {
    void loadSchedule();
    const refresh = () => { if (document.visibilityState === 'visible') void loadSchedule(); };
    const interval = setInterval(refresh, SCHEDULE_CACHE_TTL);
    document.addEventListener('visibilitychange', refresh);
    return () => { request.current?.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [loadSchedule]);

  const updateView = useCallback((week: Date, day: number) => {
    setWeekStart(week); setMobileView({ weekStartTime: week.getTime(), day });
    savePlanView(key, { weekStart: dateKey(week), day, scrollTop: 0 });
  }, [key]);
  const prevWeek = useCallback(() => updateView(addDays(weekStart, -7), 0), [updateView, weekStart]);
  const nextWeek = useCallback(() => updateView(addDays(weekStart, 7), 0), [updateView, weekStart]);
  const goToToday = useCallback(() => updateView(getWeekStart(new Date()), (new Date().getDay() + 6) % 7), [updateView]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')
        || target?.closest('input, textarea, select, button, a, [contenteditable="true"], [data-shortcuts-blocked]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevWeek(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextWeek(); }
      else if (e.key.toLowerCase() === 't') { e.preventDefault(); goToToday(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prevWeek, nextWeek, goToToday]);

  return <ScheduleGrid events={currentSchedule?.events ?? []} hasData={!!currentSchedule} loading={loading || (!currentSchedule && !error)}
    fetchedAt={currentSchedule?.fetchedAt ?? null} refreshError={error} onRefresh={() => void loadSchedule(true)}
    scheduleType={type} weekStart={weekStart} mobileView={mobileView}
    onMobileViewChange={view => { setMobileView(view); savePlanView(key, { weekStart: dateKey(weekStart), day: view.day, scrollTop: 0 }); }}
    groupName={groupName} groupPath={groupPath} customLabel={favorite?.label}
    onPrevWeek={prevWeek} onNextWeek={nextWeek} onGoToToday={goToToday}
    onChooseDate={date => updateView(getWeekStart(date), (date.getDay() + 6) % 7)}
    onToggleFavorite={() => favorite ? removeFavorite(id, type) : addFavorite(currentPlan)} isFavorite={!!favorite}
    isMyPlan={library.myPlan ? planKey(library.myPlan) === key : false} hasMyPlan={!!library.myPlan}
    onSetMyPlan={() => setMyPlan(library.myPlan && planKey(library.myPlan) === key ? null : currentPlan)}
    onReturnToMyPlan={() => { if (library.myPlan) onReturn(library.myPlan); }} onSearch={onSearch}
    initialScrollTop={initialView?.scrollTop ?? 0}
    onScrollChange={scrollTop => savePlanView(key, { weekStart: dateKey(weekStart), day: mobileView.day, scrollTop })} />;
}

function ScheduleRoute(props: Omit<SchedulePageProps, 'type' | 'id'>) {
  const { scheduleType, id } = useParams();
  const location = useLocation();
  const state = location.state as { date?: unknown } | null;
  const navigate = useNavigate();
  const targetDate = typeof state?.date === 'string' ? state.date : undefined;
  useEffect(() => {
    if (targetDate) navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null });
  }, [targetDate, navigate, location.pathname, location.search, location.hash]);
  if (!scheduleType || !id) return null;
  return <SchedulePage key={`${scheduleType}:${id}`} type={scheduleType} id={id} {...props} targetDate={targetDate} />;
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const catalog = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState<SearchKind | null>(null);
  const [library, setLibrary] = useState(readLibrary);
  const [darkMode, setDarkMode] = useState(() => readStorage<boolean>('ubb-dark-mode', !window.matchMedia('(prefers-color-scheme: light)').matches));
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = location.pathname.startsWith('/plan/') ? location.pathname.split('/').slice(2, 4).join(':') : '';
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    function update() { setLibrary(readLibrary()); }
    window.addEventListener(PLANS_CHANGED, update); window.addEventListener('storage', update);
    // Retain legacy history without assigning an incidental room as the user's own plan.
    const legacy = readStorage<{ type?: string; id?: string; name?: string; path?: string[] } | null>('ubb-last-schedule', null)
      ?? readStorage<{ type?: string; id?: string; name?: string; path?: string[] } | null>('ubb-last-plan', null);
    if (legacy?.id && legacy.type && !getRecentPlans().length) {
      const meta = getGroupMeta(legacy.id, legacy.type);
      if (meta || legacy.name) recordRecentPlan({ id: legacy.id, scheduleType: legacy.type, name: meta?.name ?? legacy.name!, path: meta?.path ?? legacy.path ?? [] });
    }
    return () => { window.removeEventListener(PLANS_CHANGED, update); window.removeEventListener('storage', update); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode); writeStorage('ubb-dark-mode', darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', darkMode ? '#10131b' : '#ffffff');
  }, [darkMode]);

  const openSearch = useCallback((kind: SearchKind = 'all') => { setSidebarOpen(false); setSearch(kind); }, []);
  const selectPlan = useCallback((plan: FavoriteGroup) => {
    saveGroupMeta(plan.id, { name: plan.name, path: plan.path, type: plan.scheduleType });
    recordRecentPlan(plan); setSidebarOpen(false); setBrowseOpen(false); setSearch(null);
    navigate(`/plan/${plan.scheduleType}/${plan.id}`);
  }, [navigate]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!document.querySelector('.event-dialog')) { setSidebarOpen(false); setSearch(value => value ? null : 'all'); }
        return;
      }
      const target = e.target instanceof Element ? e.target : null;
      if (e.defaultPrevented || document.querySelector('[role="dialog"]') || e.ctrlKey || e.metaKey || e.altKey
        || target?.closest('input, textarea, select, button, a, [contenteditable="true"], [data-shortcuts-blocked]')) return;
      if (e.key.toLowerCase() === 'd') setDarkMode(value => !value);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const otherRecent = library.recent.filter(p => (!library.myPlan || planKey(p) !== planKey(library.myPlan)) && !library.favorites.some(f => planKey(f) === planKey(p))).slice(0, 3);
  const sidebarContent = <>
    {isMobile && <button type="button" className="sidebar-search" onClick={() => openSearch()}><SearchIcon size={18} />Znajdź plan<span>{isMac ? '⌘K' : 'Ctrl K'}</span></button>}
    <section className="library-section"><h2>Twoje plany</h2><Favorites favorites={library.favorites} myPlan={library.myPlan} onSelect={selectPlan} onRemove={removeFavorite} activeKey={activeKey} /></section>
    <div className="sidebar-secondary">
      {otherRecent.length > 0 && <details className="sidebar-disclosure"><summary><ClockIcon size={17} />Ostatnio oglądane<span className="section-count">{otherRecent.length}</span></summary><ul className="recent-plans">
        {otherRecent.map(plan => {
          const display = getPlanPresentation(plan.name, plan.path, plan.scheduleType);
          return <li key={planKey(plan)}><button type="button" className="saved-plan" title={plan.name} aria-current={activeKey === planKey(plan) ? 'page' : undefined} onClick={() => selectPlan(plan)}><span><strong>{display.title}</strong><small>{display.subtitle}</small></span></button></li>;
        })}</ul></details>}
      <details ref={catalog} className="sidebar-disclosure" open={browseOpen} onToggle={e => setBrowseOpen(e.currentTarget.open)}><summary><BookOpenIcon size={17} />Przeglądaj wydziały</summary><TreeView onSelectSchedule={(type, id, name, path) => selectPlan({ scheduleType: type, id, name, path })} /></details>
      <details className="sidebar-disclosure sidebar-notices"><summary><InfoIcon size={17} />Informacje UBB</summary><Notices /></details>
    </div>
    <div className="sidebar-footer">Dane z serwisu planów UBB</div>
  </>;

  return <div className="app">
    <PWAUpdatePrompt /><a href="#main-content" className="skip-to-content">Przejdź do treści</a>
    <header className="app-header"><Link className="brand" to="/" aria-label="Plan UBB — strona główna"><img src="/logo.svg" alt="" width={28} height={28} /><span>Plan UBB</span></Link>
      <div className="header-right"><button type="button" className="header-search" onClick={() => openSearch()} aria-label="Wyszukaj plan"><SearchIcon size={18} /><span>Szukaj planu</span><kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd></button>
        <button type="button" className="icon-button" onClick={() => setDarkMode(value => !value)} aria-label={darkMode ? 'Tryb jasny' : 'Tryb ciemny'}>{darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}</button>
      </div>
    </header>
    <div className="app-body">{!isMobile && <aside className="sidebar" aria-label="Twoje plany" data-shortcuts-blocked>{sidebarContent}</aside>}
      <main className="main-content" id="main-content"><Routes>
        <Route path="/" element={<WelcomeScreen library={library} onSelect={selectPlan} onBrowse={() => { setBrowseOpen(true); setSidebarOpen(true); requestAnimationFrame(() => catalog.current?.scrollIntoView({ block: 'start' })); }} />} />
        <Route path="/plan/:scheduleType/:id" element={<ScheduleRoute library={library} onSearch={() => openSearch()} onReturn={selectPlan} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></main>
    </div>
    {isMobile && <nav className="mobile-navigation" aria-label="Nawigacja główna">
      <button type="button" onClick={() => library.myPlan ? selectPlan(library.myPlan) : navigate('/')} aria-current={library.myPlan && activeKey === planKey(library.myPlan) ? 'page' : undefined}><CalendarIcon size={21} /><span>Mój plan</span></button>
      <button type="button" onClick={() => openSearch()}><SearchIcon size={21} /><span>Szukaj</span></button>
      <button type="button" onClick={() => setSidebarOpen(true)}><StarIcon size={20} /><span>Zapisane</span></button>
    </nav>}
    {sidebarOpen && isMobile && <Dialog title="Twoje plany" onClose={() => setSidebarOpen(false)} className="library-dialog">{sidebarContent}</Dialog>}
    <CommandPalette isOpen={search !== null} initialKind={search ?? 'all'} onClose={() => setSearch(null)} onSelect={selectPlan} favorites={library.favorites} recent={library.recent} />
  </div>;
}
