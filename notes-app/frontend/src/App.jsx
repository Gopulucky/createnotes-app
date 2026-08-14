import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Article from './components/Article';
import CourseDashboard from './components/CourseDashboard';
import ImportPanel from './components/ImportPanel';
import AdminPanel from './components/AdminPanel';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './components/Home';

export const slugify = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

function CourseLayout({ db, onDbUpdate, isDarkMode, toggleTheme }) {
  const { courseSlug, topicSlug } = useParams();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeCourse = db.courses?.find(c => slugify(c.title) === courseSlug);

  const flatTopics = useMemo(() => {
    if (!activeCourse?.modules) return [];
    const arr = [];
    activeCourse.modules.forEach(m => m.topics.forEach(t => arr.push(t)));
    return arr;
  }, [activeCourse]);

  // Hooks must run unconditionally on every render — guard inside the effect body,
  // not by early-returning before the hook is declared (that crashes React with a
  // "rendered more hooks than previous render" error once `activeCourse` resolves).
  useEffect(() => {
    if (db.courses && !activeCourse) {
      navigate('/', { replace: true });
    }
  }, [db.courses, activeCourse, navigate]);

  useEffect(() => {
    if (!activeCourse || flatTopics.length === 0) return;
    const matchesSlug = topicSlug && flatTopics.some(t => slugify(t.title) === topicSlug);
    if (!matchesSlug) {
      navigate(`/course/${courseSlug}/topic/${slugify(flatTopics[0].title)}`, { replace: true });
    }
  }, [activeCourse, topicSlug, flatTopics, courseSlug, navigate]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [topicSlug]);

  if (!activeCourse) return null;

  const activeTopic = topicSlug
    ? flatTopics.find(t => slugify(t.title) === topicSlug)
    : flatTopics[0];

  return (
    <div className="app-layout">
      <button
        className="mobile-sidebar-toggle no-print"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open navigation"
        title="Open navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <div
        className={`sidebar-backdrop ${mobileSidebarOpen ? 'visible' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <Sidebar
        courseData={activeCourse}
        activeTopicId={activeTopic?.id}
        progressState={db.progress || {}}
        onDbUpdate={onDbUpdate}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {flatTopics.length > 0 && activeTopic ? (
        <Article
          topic={activeTopic}
          flatTopics={flatTopics}
          progressState={db.progress || {}}
          onDbUpdate={onDbUpdate}
        />
      ) : (
        <main className="main-content-area">
          <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--color-text-tertiary)' }}>
            <h2>No topics yet</h2>
            <p>Add a module and topic in the sidebar to get started.</p>
          </div>
        </main>
      )}
    </div>
  );
}

function MainApp() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [db, setDb] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const fetchDb = async () => {
    try {
      const res = await fetch('/api/data?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setDb(data);
      } else {
        const errText = await res.text();
        setErrorMsg(`Server Error: ${res.status} - ${errText}`);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setErrorMsg(`Network Error: Could not connect to backend. Make sure VITE_API_URL is correct.`);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDb();
    }
  }, [currentUser]);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  if (!currentUser) {
    return <Home isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
  }

  if (errorMsg) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        <h2>Connection Error</h2>
        <p>{errorMsg}</p>
        <button 
          onClick={() => { setErrorMsg(null); fetchDb(); }}
          style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="app-loading-state">
        <div className="app-loading-spinner" aria-hidden="true" />
        <p>Preparing your workspace…</p>
      </div>
    );
  }

  const handleDbUpdate = (newDb) => {
    setDb(newDb);
  };

  const isArticlePage = location.pathname.includes('/course/');

  return (
    <div className="app-container">
      {!isArticlePage && <Navbar isDarkMode={isDarkMode} toggleTheme={toggleTheme} isAdmin={!!db.isAdmin} />}
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <CourseDashboard
                courses={db.courses || []}
                progressState={db.progress || {}}
                onDbUpdate={handleDbUpdate}
              />
            }
          />
          <Route
            path="/course/:courseSlug"
            element={<CourseLayout db={db} onDbUpdate={handleDbUpdate} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
          />
          <Route
            path="/course/:courseSlug/topic/:topicSlug"
            element={<CourseLayout db={db} onDbUpdate={handleDbUpdate} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
          />
          <Route
            path="/import"
            element={<ImportPanel courses={db.courses || []} onImportComplete={fetchDb} />}
          />
          <Route
            path="/admin"
            element={<AdminPanel isAdmin={!!db.isAdmin} />}
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
