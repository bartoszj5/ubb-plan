import { useState, useEffect, useCallback } from 'react';
import TreeView from './components/TreeView';
import ScheduleGrid from './components/ScheduleGrid';
import Favorites from './components/Favorites';
import { MenuIcon, SunIcon, MoonIcon, BookOpenIcon, BuildingIcon, CalendarIcon, StarIcon } from './components/Icons';
import type { ScheduleEvent, FavoriteGroup } from './types';
import { fetchSchedule } from './utils/api';
import { getFavorites, addFavorite, removeFavorite, isFavorite } from './utils/favorites';
import './App.css';

const LAST_SCHEDULE_KEY = 'ubb-last-schedule';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getUBBWeekNumber(weekStart: Date): number {
  // Reference: w=758 = week starting Monday March 2, 2026
  const refDate = new Date(2026, 2, 2); // March 2, 2026
  refDate.setHours(0, 0, 0, 0);
  const diffMs = weekStart.getTime() - refDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return 758 + diffWeeks;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('ubb-dark-mode') === 'true' ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [favorites, setFavorites] = useState<FavoriteGroup[]>([]);

  const [selectedGroup, setSelectedGroup] = useState<{
    type: string;
    id: string;
    name: string;
    path: string[];
  } | null>(null);

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFavorites(getFavorites());
    // Restore last viewed schedule
    try {
      const stored = localStorage.getItem(LAST_SCHEDULE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.type && parsed.id && parsed.name) {
          setSelectedGroup(parsed);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('ubb-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (selectedGroup) {
      localStorage.setItem(LAST_SCHEDULE_KEY, JSON.stringify(selectedGroup));
      loadSchedule();
    }
  }, [selectedGroup, weekStart]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) {
        handlePrevWeek();
      } else if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) {
        handleNextWeek();
      } else if (e.key === 't' || e.key === 'T') {
        handleGoToToday();
      } else if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadSchedule() {
    if (!selectedGroup) return;

    setLoading(true);
    setError(null);

    try {
      const weekNumber = getUBBWeekNumber(weekStart);
      const data = await fetchSchedule(selectedGroup.type, selectedGroup.id, weekNumber);
      setEvents(data);
    } catch (err) {
      setError('Nie udalo sie wczytac planu zajec');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectSchedule = useCallback((type: string, id: string, name: string, path: string[]) => {
    setSelectedGroup({ type, id, name, path });
    setWeekStart(getWeekStart(new Date()));

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handleSelectFavorite = useCallback((favorite: FavoriteGroup) => {
    setSelectedGroup({
      type: favorite.scheduleType,
      id: favorite.id,
      name: favorite.name,
      path: favorite.path
    });
    setWeekStart(getWeekStart(new Date()));

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!selectedGroup) return;

    if (isFavorite(selectedGroup.id)) {
      setFavorites(removeFavorite(selectedGroup.id));
    } else {
      const newFavorite: FavoriteGroup = {
        id: selectedGroup.id,
        name: selectedGroup.name,
        path: selectedGroup.path,
        scheduleType: selectedGroup.type
      };
      setFavorites(addFavorite(newFavorite));
    }
  }, [selectedGroup]);

  const handlePrevWeek = useCallback(() => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  }, []);

  const handleGoToToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
  }, []);

  return (
    <div className="app">
      <a href="#main-content" className="skip-to-content">
        Przejdz do tresci
      </a>

      <header className="app-header">
        <div className="header-left">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Zamknij menu' : 'Otworz menu'}
          >
            <MenuIcon size={18} />
          </button>
          <h1><CalendarIcon size={20} /> Plan Zajec UBB</h1>
        </div>
        <div className="header-right">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Tryb jasny' : 'Tryb ciemny'}
          >
            {darkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>
        </div>
      </header>

      <div className="app-body">
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-section favorites-section">
            <Favorites
              favorites={favorites}
              onSelect={handleSelectFavorite}
              onRemove={(id) => setFavorites(removeFavorite(id))}
            />
          </div>
          <div className="sidebar-section tree-section">
            <h3><BookOpenIcon size={14} /> Wydzialy</h3>
            <TreeView onSelectSchedule={handleSelectSchedule} />
          </div>
        </aside>

        <main className="main-content" id="main-content">
          {!selectedGroup ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>Witaj w aplikacji Plan Zajec UBB</h2>
                <p>Wybierz grupe z menu po lewej stronie lub z ulubionych</p>
                <div className="welcome-tips">
                  <div className="tip">
                    <span className="tip-icon-wrap"><BuildingIcon size={22} /></span>
                    <span>Kliknij na wydzial, aby rozwinac kierunki</span>
                  </div>
                  <div className="tip">
                    <span className="tip-icon-wrap"><CalendarIcon size={22} /></span>
                    <span>Wybierz grupe, aby zobaczyc plan</span>
                  </div>
                  <div className="tip">
                    <span className="tip-icon-wrap"><StarIcon size={22} /></span>
                    <span>Dodaj ulubione grupy dla szybkiego dostepu</span>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="loading-screen">
              <div className="loader"></div>
              <p>Ladowanie planu zajec...</p>
            </div>
          ) : error ? (
            <div className="error-screen">
              <p>{error}</p>
              <button onClick={loadSchedule}>Sprobuj ponownie</button>
            </div>
          ) : (
            <ScheduleGrid
              events={events}
              weekStart={weekStart}
              groupName={selectedGroup.name}
              groupPath={selectedGroup.path}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onGoToToday={handleGoToToday}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={isFavorite(selectedGroup.id)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
