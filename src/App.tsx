import { useState, useEffect, useCallback } from 'react';
import TreeView from './components/TreeView';
import ScheduleGrid from './components/ScheduleGrid';
import Favorites from './components/Favorites';
import type { ScheduleEvent, FavoriteGroup } from './types';
import { fetchSchedule } from './utils/api';
import { getFavorites, addFavorite, removeFavorite, isFavorite } from './utils/favorites';
import './App.css';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
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
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('ubb-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (selectedGroup) {
      loadSchedule();
    }
  }, [selectedGroup, weekStart]);

  async function loadSchedule() {
    if (!selectedGroup) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchSchedule(selectedGroup.type, selectedGroup.id);
      setEvents(data);
    } catch (err) {
      setError('Nie udało się wczytać planu zajęć');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectSchedule = useCallback((type: string, id: string, name: string, path: string[]) => {
    setSelectedGroup({ type, id, name, path });
    setWeekStart(getWeekStart(new Date()));
    
    // Close sidebar on mobile
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button 
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1>📅 Plan Zajęć UBB</h1>
        </div>
        <div className="header-right">
          <button 
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Tryb jasny' : 'Tryb ciemny'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-section favorites-section">
            <Favorites 
              favorites={favorites}
              onSelect={handleSelectFavorite}
              onRemove={(id) => setFavorites(removeFavorite(id))}
            />
          </div>
          <div className="sidebar-section tree-section">
            <h3>📚 Wydziały</h3>
            <TreeView onSelectSchedule={handleSelectSchedule} />
          </div>
        </aside>

        <main className="main-content">
          {!selectedGroup ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>👋 Witaj w aplikacji Plan Zajęć UBB</h2>
                <p>Wybierz grupę z menu po lewej stronie lub z ulubionych</p>
                <div className="welcome-tips">
                  <div className="tip">
                    <span className="tip-icon">🏛️</span>
                    <span>Kliknij na wydział, aby rozwinąć kierunki</span>
                  </div>
                  <div className="tip">
                    <span className="tip-icon">📅</span>
                    <span>Wybierz grupę, aby zobaczyć plan</span>
                  </div>
                  <div className="tip">
                    <span className="tip-icon">⭐</span>
                    <span>Dodaj ulubione grupy dla szybkiego dostępu</span>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="loading-screen">
              <div className="loader"></div>
              <p>Ładowanie planu zajęć...</p>
            </div>
          ) : error ? (
            <div className="error-screen">
              <p>{error}</p>
              <button onClick={loadSchedule}>Spróbuj ponownie</button>
            </div>
          ) : (
            <ScheduleGrid
              events={events}
              weekStart={weekStart}
              groupName={selectedGroup.name}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
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
