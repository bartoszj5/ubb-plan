import { useState, useEffect, useCallback } from "react";
import {
  Routes,
  Route,
  useParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import TreeView from "./components/TreeView";
import ScheduleGrid from "./components/ScheduleGrid";
import Favorites from "./components/Favorites";
import {
  MenuIcon,
  SunIcon,
  MoonIcon,
  BookOpenIcon,
  BuildingIcon,
  CalendarIcon,
  StarIcon,
} from "./components/Icons";
import type { ScheduleEvent, FavoriteGroup } from "./types";
import { fetchSchedule, fetchGroupInfo } from "./utils/api";
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
} from "./utils/favorites";
import { saveGroupMeta, getGroupMeta } from "./utils/groupMeta";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import "./App.css";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getUBBWeekNumber(weekStart: Date): number {
  const refDate = new Date(2026, 2, 2);
  refDate.setHours(0, 0, 0, 0);
  const diffMs = weekStart.getTime() - refDate.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return 758 + diffWeeks;
}

function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h2>Witaj w aplikacji Plan Zajęć UBB</h2>
        <p>Wybierz grupę z menu po lewej stronie lub z ulubionych</p>
        <div className="welcome-tips">
          <div className="tip">
            <span className="tip-icon-wrap">
              <BuildingIcon size={22} />
            </span>
            <span>Kliknij na wydział, aby rozwinąć kierunki</span>
          </div>
          <div className="tip">
            <span className="tip-icon-wrap">
              <CalendarIcon size={22} />
            </span>
            <span>Wybierz grupe, aby zobaczyc plan</span>
          </div>
          <div className="tip">
            <span className="tip-icon-wrap">
              <StarIcon size={22} />
            </span>
            <span>Dodaj ulubione grupy dla szybkiego dostępu</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SchedulePage() {
  const { scheduleType, id } = useParams<{
    scheduleType: string;
    id: string;
  }>();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState(() => {
    const meta = id ? getGroupMeta(id) : null;
    return meta?.name ?? id ?? "";
  });
  const [groupPath, setGroupPath] = useState<string[]>(() => {
    const meta = id ? getGroupMeta(id) : null;
    return meta?.path ?? [];
  });

  // Save as last viewed plan
  useEffect(() => {
    if (!id || !scheduleType) return;
    localStorage.setItem("ubb-last-plan", JSON.stringify({ type: scheduleType, id }));
  }, [id, scheduleType]);

  // Fetch group metadata from API if not in localStorage
  useEffect(() => {
    if (!id || !scheduleType) return;
    const meta = getGroupMeta(id);
    if (meta) {
      setGroupName(meta.name);
      setGroupPath(meta.path);
      return;
    }

    fetchGroupInfo(scheduleType, id)
      .then((info) => {
        saveGroupMeta(id, { name: info.name, path: info.path, type: scheduleType });
        setGroupName(info.name);
        setGroupPath(info.path);
      })
      .catch(() => {/* ignore */});
  }, [id, scheduleType]);

  const loadSchedule = useCallback(async () => {
    if (!scheduleType || !id) return;

    setLoading(true);
    setError(null);

    try {
      const weekNumber = getUBBWeekNumber(weekStart);
      const data = await fetchSchedule(scheduleType, id, weekNumber);
      setEvents(data);
    } catch (err) {
      setError("Nie udało się wczytać planu zajęć");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [scheduleType, id, weekStart]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Keyboard shortcuts for week navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowLeft" && !e.metaKey && !e.ctrlKey) {
        handlePrevWeek();
      } else if (e.key === "ArrowRight" && !e.metaKey && !e.ctrlKey) {
        handleNextWeek();
      } else if (e.key === "t" || e.key === "T") {
        handleGoToToday();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  }, []);

  const handleGoToToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
  }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!id || !scheduleType) return;

    if (isFavorite(id)) {
      removeFavorite(id);
    } else {
      const newFavorite: FavoriteGroup = {
        id,
        name: groupName,
        path: groupPath,
        scheduleType,
      };
      addFavorite(newFavorite);
    }
    // Force re-render by dispatching a storage event
    window.dispatchEvent(new Event("favorites-changed"));
  }, [id, scheduleType, groupName, groupPath]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Ladowanie planu zajęć...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <p>{error}</p>
        <button onClick={loadSchedule}>Sprobuj ponownie</button>
      </div>
    );
  }

  return (
    <ScheduleGrid
      events={events}
      weekStart={weekStart}
      groupName={groupName}
      groupPath={groupPath}
      onPrevWeek={handlePrevWeek}
      onNextWeek={handleNextWeek}
      onGoToToday={handleGoToToday}
      onToggleFavorite={handleToggleFavorite}
      isFavorite={id ? isFavorite(id) : false}
    />
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return (
      localStorage.getItem("ubb-dark-mode") === "true" ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });
  const [favorites, setFavorites] = useState<FavoriteGroup[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Migrate from old localStorage-based navigation & restore last schedule
  useEffect(() => {
    setFavorites(getFavorites());

    if (location.pathname === "/") {
      try {
        // Migrate old format
        const oldStored = localStorage.getItem("ubb-last-schedule");
        if (oldStored) {
          const parsed = JSON.parse(oldStored);
          if (parsed?.type && parsed?.id && parsed?.name) {
            saveGroupMeta(parsed.id, {
              name: parsed.name,
              path: parsed.path ?? [],
              type: parsed.type,
            });
            localStorage.setItem("ubb-last-plan", JSON.stringify({ type: parsed.type, id: parsed.id }));
            localStorage.removeItem("ubb-last-schedule");
          }
        }

        // Redirect to last viewed plan
        const lastPlan = localStorage.getItem("ubb-last-plan");
        if (lastPlan) {
          const { type, id } = JSON.parse(lastPlan);
          if (type && id) {
            navigate(`/plan/${type}/${id}`, { replace: true });
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Listen for favorites changes from SchedulePage
  useEffect(() => {
    const handler = () => setFavorites(getFavorites());
    window.addEventListener("favorites-changed", handler);
    return () => window.removeEventListener("favorites-changed", handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("ubb-dark-mode", String(darkMode));
  }, [darkMode]);

  // Keyboard shortcut: Escape to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectSchedule = useCallback(
    (type: string, id: string, name: string, path: string[]) => {
      saveGroupMeta(id, { name, path, type });
      navigate(`/plan/${type}/${id}`);

      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    },
    [navigate],
  );

  const handleSelectFavorite = useCallback(
    (favorite: FavoriteGroup) => {
      saveGroupMeta(favorite.id, {
        name: favorite.name,
        path: favorite.path,
        type: favorite.scheduleType,
      });
      navigate(`/plan/${favorite.scheduleType}/${favorite.id}`);

      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    },
    [navigate],
  );

  return (
    <div className="app">
      <PWAUpdatePrompt />
      <a href="#main-content" className="skip-to-content">
        Przejdz do tresci
      </a>

      <header className="app-header">
        <div className="header-left">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Zamknij menu" : "Otwórz menu"}
          >
            <MenuIcon size={18} />
          </button>
          <h1>
            <img
              src="/logo.svg"
              alt=""
              width={22}
              height={22}
              className="header-logo"
            />{" "}
            Plan Zajęć UBB
          </h1>
        </div>
        <div className="header-right">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? "Tryb jasny" : "Tryb ciemny"}
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

        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-section favorites-section">
            <Favorites
              favorites={favorites}
              onSelect={handleSelectFavorite}
              onRemove={(id) => setFavorites(removeFavorite(id))}
            />
          </div>
          <div className="sidebar-section tree-section">
            <h3>
              <BookOpenIcon size={14} /> Wydzialy
            </h3>
            <TreeView onSelectSchedule={handleSelectSchedule} />
          </div>
        </aside>

        <main className="main-content" id="main-content">
          <Routes>
            <Route path="/" element={<WelcomeScreen />} />
            <Route
              path="/plan/:scheduleType/:id"
              element={<SchedulePage />}
            />
            <Route path="*" element={<WelcomeScreen />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
