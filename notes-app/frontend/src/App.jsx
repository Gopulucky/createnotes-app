import React, { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Article from './components/Article';
import CourseDashboard from './components/CourseDashboard';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';

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

  const activeCourse = db.courses?.find(c => slugify(c.title) === courseSlug);
  
  useEffect(() => {
    if (db.courses && !activeCourse) {
      navigate('/', { replace: true });
    }
  }, [db.courses, activeCourse, navigate]);

  if (!activeCourse) return null;

  const flatTopics = [];
  if (activeCourse.modules) {
    activeCourse.modules.forEach(m => {
      m.topics.forEach(t => flatTopics.push(t));
    });
  }

  useEffect(() => {
    if (!topicSlug && flatTopics.length > 0) {
      navigate(`/course/${courseSlug}/topic/${slugify(flatTopics[0].title)}`, { replace: true });
    }
  }, [topicSlug, flatTopics, courseSlug, navigate]);

  const activeTopic = topicSlug 
    ? flatTopics.find(t => slugify(t.title) === topicSlug) 
    : flatTopics[0];

  return (
    <div className="app-layout">
      <Sidebar 
        courseData={activeCourse} 
        activeTopicId={activeTopic?.id} 
        progressState={db.progress || {}}
        onDbUpdate={onDbUpdate}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
      />
      
      {flatTopics.length > 0 && activeTopic ? (
        <Article 
          topic={activeTopic} 
          flatTopics={flatTopics}
          progressState={db.progress || {}}
          notesState={db.notes || {}}
          codeNotesState={db.codeNotes || {}}
          imagesState={db.images || {}}
          keyConceptsState={db.keyConcepts || {}}
          flashcardsState={db.flashcards || {}}
          expectedOutputState={db.expectedOutput || {}}
          codeMetaState={db.codeMeta || {}}
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
    return <Login isDarkMode={isDarkMode} />;
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
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading application...</div>;
  }

  const handleDbUpdate = (newDb) => {
    setDb(newDb);
  };

  const location = useLocation();
  const isArticlePage = location.pathname.includes('/course/');

  return (
    <div className="app-container">
      {!isArticlePage && <Navbar isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={
              <CourseDashboard 
                courses={db.courses || []} 
                progressState={db.progress || {}}
                onDbUpdate={handleDbUpdate}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
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
        </Routes>
      </main>
      <Footer />
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
