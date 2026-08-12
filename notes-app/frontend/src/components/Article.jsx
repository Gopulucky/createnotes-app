import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { slugify } from '../App';
import PomodoroTimer from './PomodoroTimer';
import Flashcards from './Flashcards';

// Monaco is a multi-MB dependency — only fetch it when the Code tab is actually opened.
const Editor = lazy(() => import('@monaco-editor/react'));

const EMPTY_CONTENT = {
  progress: 'not-started', notes: '', codeNotes: '', images: [],
  keyConcepts: '', flashcards: [], expectedOutput: '', codeMeta: { filename: 'script.js' },
};

const EditIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '6px' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const RevealIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ marginRight: '8px' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>);
const HideIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '4px' }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>);
const CopyIcon = () => (<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: '6px' }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);

const TOC_SECTIONS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'key-concepts', label: 'Key Concepts' },
  { id: 'diagrams', label: 'Images & Diagrams' },
  { id: 'my-notes', label: 'Text Notes' }
];

export default function Article({ topic, flatTopics, progressState, onDbUpdate }) {
  const [localNotes, setLocalNotes] = useState('');
  const [localCode, setLocalCode] = useState('');
  const [localKeyConcepts, setLocalKeyConcepts] = useState('');
  const [localExpectedOutput, setLocalExpectedOutput] = useState('');
  const [localCodeMeta, setLocalCodeMeta] = useState({ filename: 'script.js' });
  const [localImages, setLocalImages] = useState([]);
  const [localFlashcards, setLocalFlashcards] = useState([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Edit mode toggles
  const [isEditingKeyConcepts, setIsEditingKeyConcepts] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingOutput, setIsEditingOutput] = useState(false);
  const [isEditingCodeMeta, setIsEditingCodeMeta] = useState(false);
  const [isOutputRevealed, setIsOutputRevealed] = useState(false);
  const [activeSection, setActiveSection] = useState('introduction');
  const [activeView, setActiveView] = useState('article');

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { courseSlug } = useParams();

  // ScrollSpy for Table of Contents
  useEffect(() => {
    if (!topic) return;

    const observerOptions = {
      root: document.querySelector('.main-content-area'),
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0
    };

    const handleIntersect = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    TOC_SECTIONS.forEach(sec => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [topic, activeView]);

  // Fetch this topic's content on demand instead of relying on a global blob that would
  // otherwise carry every topic's base64 images on every load.
  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    setContentLoading(true);
    setIsEditingKeyConcepts(false);
    setIsEditingNotes(false);
    setIsEditingOutput(false);
    setIsEditingCodeMeta(false);
    setIsOutputRevealed(false);

    fetch(`/api/topics/${topic.id}/content`)
      .then(res => res.ok ? res.json() : EMPTY_CONTENT)
      .then(data => {
        if (cancelled) return;
        setLocalNotes(data.notes || '');
        setLocalCode(data.codeNotes || '');
        setLocalKeyConcepts(data.keyConcepts || '');
        setLocalExpectedOutput(data.expectedOutput || '');
        setLocalCodeMeta(data.codeMeta && Object.keys(data.codeMeta).length ? data.codeMeta : { filename: 'script.js' });
        setLocalImages(data.images || []);
        setLocalFlashcards(data.flashcards || []);
      })
      .catch(err => console.error('Failed to load topic content:', err))
      .finally(() => { if (!cancelled) setContentLoading(false); });

    return () => { cancelled = true; };
  }, [topic]);

  if (!topic) return <main className="main-content-area">Select or create a topic</main>;

  const currentIndex = flatTopics.findIndex(t => t.id === topic.id);
  const handlePrev = () => {
    if (currentIndex > 0) {
      navigate(`/course/${courseSlug}/topic/${slugify(flatTopics[currentIndex - 1].title)}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < flatTopics.length - 1) {
      navigate(`/course/${courseSlug}/topic/${slugify(flatTopics[currentIndex + 1].title)}`);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, status })
      });
      onDbUpdate(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleNotesBlur = async () => {
    setIsEditingNotes(false);
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, content: localNotes })
      });
    } catch (err) { console.error(err); }
  };

  const handleKeyConceptsBlur = async () => {
    setIsEditingKeyConcepts(false);
    try {
      await fetch('/api/keyConcepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, content: localKeyConcepts })
      });
    } catch (err) { console.error(err); }
  };

  const handleOutputBlur = async () => {
    setIsEditingOutput(false);
    try {
      await fetch('/api/expectedOutput', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, content: localExpectedOutput })
      });
    } catch (err) { console.error(err); }
  };

  const handleCodeMetaBlur = async () => {
    setIsEditingCodeMeta(false);
    try {
      await fetch('/api/codeMeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, meta: localCodeMeta })
      });
    } catch (err) { console.error(err); }
  };

  const handleCodeChange = (value) => {
    setLocalCode(value || '');
  };

  const handleCodeBlur = async () => {
    try {
      await fetch('/api/codeNotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, content: localCode })
      });
    } catch (err) { console.error(err); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('topicId', topic.id);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      setLocalImages(data.images || []);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) { console.error('Upload failed', err); }
  };

  const handleDeleteImage = async (imageUrl) => {
    if (!confirm("Are you sure you want to remove this image?")) return;
    try {
      const res = await fetch('/api/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, imageUrl })
      });

      if (res.ok) {
        const data = await res.json();
        setLocalImages(data.images || []);
      } else {
        alert("Failed to delete image.");
      }
    } catch (e) { console.error(e); }
  };

  const handleCopyCode = () => {
    if (!localCode) return;
    navigator.clipboard.writeText(localCode);
    // Could add a toast here, but simple alert or visual feedback works for now.
    const btn = document.getElementById('copy-code-btn-text');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Copied!';
      setTimeout(() => btn.innerHTML = originalText, 2000);
    }
  };

  const handleExportCode = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, topicTitle: topic.title, content: localCode })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully exported and committed to Git at:\n${data.path}`);
      } else {
        alert(`Export failed: ${data.error}`);
      }
    } catch (err) {
      alert('Network error during export');
    }
    setExporting(false);
  };

  const handleFlashcardsSave = async (newCards) => {
    setLocalFlashcards(newCards);
    try {
      await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, flashcards: newCards })
      });
    } catch (err) { console.error(err); }
  };

  const currentStatus = progressState[topic.id] || 'not-started';
  const topicImages = localImages;
  const topicFlashcards = localFlashcards;

  const prevTopic = currentIndex > 0 ? flatTopics[currentIndex - 1] : null;
  const nextTopic = currentIndex < flatTopics.length - 1 ? flatTopics[currentIndex + 1] : null;

  return (
    <main className="main-content-area print-area">
      <div className="article-layout">

        {/* Main Content Column */}
        <div className="article-main-col">
          {contentLoading && <div className="content-loading-bar" aria-hidden="true" />}

        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <span className={`difficulty-badge ${topic.difficulty}`}>
            {topic.difficulty}
          </span>
          <button 
            onClick={() => window.print()}
            style={{ padding: '6px 12px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', cursor: 'pointer', color: 'var(--color-text-primary)' }}
          >
            Save as PDF
          </button>
        </div>

        <h1 id="introduction">{topic.title}</h1>
        
        <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => handleStatusChange('not-started')} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: currentStatus === 'not-started' ? 'var(--color-bg-tertiary)' : 'transparent', border: '1px solid var(--color-border-secondary)' }}>Not Started</button>
          <button onClick={() => handleStatusChange('in-progress')} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: currentStatus === 'in-progress' ? 'var(--color-easy-bg)' : 'transparent', border: '1px solid var(--color-easy)' }}>In Progress</button>
          <button onClick={() => handleStatusChange('mastered')} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: currentStatus === 'mastered' ? 'var(--color-success)' : 'transparent', color: currentStatus === 'mastered' ? 'white' : 'inherit', border: `1px solid var(--color-success)` }}>Mastered</button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid var(--color-border-primary)', marginBottom: '32px' }}>
          <button 
            onClick={() => setActiveView('article')}
            style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeView === 'article' ? '2px solid var(--color-brand)' : '2px solid transparent', color: activeView === 'article' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: activeView === 'article' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem' }}
          >
            Article
          </button>
          <button 
            onClick={() => setActiveView('code')}
            style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeView === 'code' ? '2px solid var(--color-brand)' : '2px solid transparent', color: activeView === 'code' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: activeView === 'code' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem' }}
          >
            Code
          </button>
          <button 
            onClick={() => setActiveView('flashcards')}
            style={{ padding: '12px 24px', background: 'transparent', border: 'none', borderBottom: activeView === 'flashcards' ? '2px solid var(--color-brand)' : '2px solid transparent', color: activeView === 'flashcards' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: activeView === 'flashcards' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem' }}
          >
            Flashcards
          </button>
        </div>

        {activeView === 'article' && (
          <>
            <div id="key-concepts">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Key Concepts</h2>
            {!isEditingKeyConcepts && (
              <button 
                className="no-print"
                onClick={() => setIsEditingKeyConcepts(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}
              >
                <EditIcon /> Edit
              </button>
            )}
          </div>
          
          {isEditingKeyConcepts ? (
            <textarea
              className="notes-editor-placeholder"
              style={{ minHeight: '150px' }}
              placeholder={`Enter key concepts for ${topic.title} here...`}
              value={localKeyConcepts}
              onChange={(e) => setLocalKeyConcepts(e.target.value)}
              onBlur={handleKeyConceptsBlur}
              autoFocus
            />
          ) : (
            <div 
              onClick={() => setIsEditingKeyConcepts(true)}
              style={{ 
                minHeight: '100px',
                padding: '24px',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-primary)',
                cursor: 'pointer',
                color: localKeyConcepts ? 'inherit' : 'var(--color-text-tertiary)',
                lineHeight: 1.6
              }}
              className="markdown-content"
            >
              {localKeyConcepts ? <ReactMarkdown>{localKeyConcepts}</ReactMarkdown> : `Click here to add key concepts for ${topic.title}...`}
            </div>
          )}
        </div>

        {/* Images Area */}
        <div id="diagrams" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Reference Images & Diagrams</h2>
            <div className="no-print">
              <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '8px 16px', background: 'var(--color-brand)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}
              >
                + Upload Image
              </button>
            </div>
          </div>
          
          {topicImages.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '16px' }}>
              {topicImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: '100%', minHeight: '120px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-primary)', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img
                    src={img.startsWith('http') || img.startsWith('data:') ? img : `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${img}`}
                    alt="Uploaded reference"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline><line x1="3" y1="3" x2="21" y2="21"></line></svg>';
                      e.target.style.objectFit = 'none';
                    }}
                    style={{ width: '100%', height: '100%', maxHeight: '400px', objectFit: 'contain' }} 
                  />
                  <button 
                    className="no-print"
                    onClick={() => handleDeleteImage(img)}
                    style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="my-notes" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Text Notes</h2>
            {!isEditingNotes && (
              <button 
                className="no-print"
                onClick={() => setIsEditingNotes(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}
              >
                <EditIcon /> Edit
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <textarea
              className="notes-editor-placeholder"
              style={{ minHeight: '200px' }}
              placeholder="Start typing your text notes here... (Auto-saves on blur)"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              autoFocus
            />
          ) : (
            <div 
              onClick={() => setIsEditingNotes(true)}
              style={{
                minHeight: '100px',
                padding: '24px',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-primary)',
                cursor: 'pointer',
                color: localNotes ? 'inherit' : 'var(--color-text-tertiary)',
                lineHeight: 1.6
              }}
              className="markdown-content"
            >
              {localNotes ? <ReactMarkdown>{localNotes}</ReactMarkdown> : "Click here to start typing your text notes..."}
            </div>
          )}
        </div>
          </>
        )}

        {activeView === 'code' && (
          <>
            <div id="code-editor">
              <h2>Code Implementations</h2>
          <div className="code-editor-wrapper" style={{ border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: '#1e1e1e', marginBottom: '16px' }}>
            
            {/* ChatGPT-Style Code Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2d333b', padding: '8px 16px', borderBottom: '1px solid #111' }}>
              {isEditingCodeMeta ? (
                <input 
                  type="text" 
                  value={localCodeMeta.filename}
                  onChange={(e) => setLocalCodeMeta({ ...localCodeMeta, filename: e.target.value })}
                  onBlur={handleCodeMetaBlur}
                  autoFocus
                  style={{ background: '#1e1e1e', color: '#7ee787', border: '1px solid #444', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontFamily: 'monospace', outline: 'none' }}
                />
              ) : (
                <span 
                  onClick={() => setIsEditingCodeMeta(true)}
                  style={{ color: '#8b949e', fontSize: '0.75rem', fontFamily: 'monospace', cursor: 'text', padding: '2px 8px', borderRadius: '4px' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Click to edit filename"
                >
                  {localCodeMeta.filename}
                </span>
              )}
              <button
                id="copy-code-btn"
                onClick={handleCopyCode}
                style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: '#8b949e', fontSize: '0.75rem', cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#c9d1d9'}
                onMouseOut={(e) => e.currentTarget.style.color = '#8b949e'}
              >
                <CopyIcon /> <span id="copy-code-btn-text">Copy code</span>
              </button>
            </div>

            <div style={{ padding: '16px 0' }}>
              <Suspense fallback={<div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: '0.875rem' }}>Loading editor…</div>}>
                <Editor
                  height="350px"
                  theme="vs-dark"
                  path={localCodeMeta.filename}
                  value={localCode}
                  onChange={handleCodeChange}
                  onMount={(editor) => {
                    editor.onDidBlurEditorText(() => {
                      handleCodeBlur();
                    });
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: '"Fira code", "Consolas", monospace',
                    padding: { top: 16 }
                  }}
                />
              </Suspense>
            </div>
          </div>
          <div className="no-print" style={{ textAlign: 'right' }}>
            <button 
              onClick={handleExportCode}
              disabled={exporting || !localCode.trim()}
              style={{ padding: '8px 16px', background: 'var(--color-brand)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', opacity: (!localCode.trim() || exporting) ? 0.5 : 1 }}
            >
              {exporting ? 'Exporting...' : 'Export Code to Git'}
            </button>
          </div>

          {/* Expected Output Puzzle UI */}
          <div style={{ marginTop: '24px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-family-sans)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-secondary)', margin: 0 }}>Expected Output</h3>
              {!isEditingOutput && (
                <button 
                  className="no-print"
                  onClick={() => setIsEditingOutput(true)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}
                >
                  <EditIcon /> Edit Output
                </button>
              )}
            </div>

            <div style={{ padding: '16px', background: '#0d1117' }}>
              {isEditingOutput ? (
                <textarea
                  className="notes-editor-placeholder"
                  style={{ minHeight: '100px', width: '100%', background: 'transparent', color: '#c9d1d9', border: '1px solid #30363d', padding: '12px', fontFamily: 'monospace' }}
                  placeholder="Paste the exact output here... (Auto-saves on blur)"
                  value={localExpectedOutput}
                  onChange={(e) => setLocalExpectedOutput(e.target.value)}
                  onBlur={handleOutputBlur}
                  autoFocus
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <div 
                    style={{ 
                      color: localExpectedOutput ? '#7ee787' : 'var(--color-text-tertiary)', 
                      fontFamily: localExpectedOutput ? 'monospace' : 'inherit', 
                      whiteSpace: 'pre-wrap', 
                      minHeight: '60px',
                      filter: (!isOutputRevealed && localExpectedOutput) ? 'blur(5px)' : 'none',
                      opacity: (!isOutputRevealed && localExpectedOutput) ? 0.4 : 1,
                      transition: 'all 0.3s ease',
                      userSelect: isOutputRevealed ? 'auto' : 'none'
                    }}
                  >
                    {localExpectedOutput || "No expected output defined yet. Click Edit Output to add some!"}
                  </div>
                  
                  {!isOutputRevealed && localExpectedOutput && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button 
                        onClick={() => setIsOutputRevealed(true)}
                        style={{ display: 'flex', alignItems: 'center', background: 'var(--color-brand)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', transition: 'transform 0.2s ease' }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <RevealIcon /> Reveal Output
                      </button>
                    </div>
                  )}
                  {isOutputRevealed && localExpectedOutput && (
                    <button 
                      onClick={() => setIsOutputRevealed(false)}
                      style={{ position: 'absolute', top: '-8px', right: '0', background: 'transparent', color: '#8b949e', border: 'none', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#c9d1d9'}
                      onMouseOut={(e) => e.currentTarget.style.color = '#8b949e'}
                    >
                      <HideIcon /> Hide Output
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
          </>
        )}

        {activeView === 'flashcards' && (
          <div id="flashcards">
            {/* key={topic.id} forces a remount on topic change so Flashcards' internal
                cards/currentIndex/score state doesn't go stale when navigating via
                the Prev/Next buttons while this tab stays mounted. */}
            <Flashcards key={topic.id} flashcards={topicFlashcards} onSave={handleFlashcardsSave} />
          </div>
        )}

        <div className="page-navigation no-print">
          {prevTopic ? (
            <button className="nav-button" onClick={handlePrev}>
              <span className="nav-button-label">Previous</span>
              <span className="nav-button-title">← {prevTopic.title}</span>
            </button>
          ) : <div></div>}

          {nextTopic ? (
            <button className="nav-button next" onClick={handleNext}>
              <span className="nav-button-label">Next</span>
              <span className="nav-button-title">{nextTopic.title} →</span>
            </button>
          ) : <div></div>}
        </div>
        </div> {/* CLOSE MAIN CONTENT COLUMN */}

        {/* Right Sidebar - Table of Contents & Pomodoro (moves below the article on mobile, see .article-aside) */}
        <aside className="no-print article-aside">
          <div>
            
            {/* Pomodoro Timer Widget */}
            <PomodoroTimer />

            {/* Outline */}
            {activeView === 'article' && (
              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontFamily: 'var(--font-family-sans)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-tertiary)', marginBottom: '16px', marginTop: 0 }}>On this page</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {TOC_SECTIONS.map(sec => (
                      <a 
                        key={sec.id}
                        href={`#${sec.id}`} 
                        style={{ 
                          textDecoration: 'none', 
                          color: activeSection === sec.id ? 'var(--color-brand)' : 'var(--color-text-secondary)', 
                          fontWeight: activeSection === sec.id ? 700 : 400,
                          fontSize: '0.9rem',
                          borderLeft: activeSection === sec.id ? '3px solid var(--color-brand)' : '3px solid transparent',
                          paddingLeft: '12px',
                          marginLeft: '-15px',
                          transition: 'all 0.2s ease-in-out'
                        }} 
                        onMouseOver={(e) => e.target.style.color = 'var(--color-brand)'} 
                        onMouseOut={(e) => e.target.style.color = activeSection === sec.id ? 'var(--color-brand)' : 'var(--color-text-secondary)'}
                      >
                        {sec.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

      </div>
    </main>
  );
}
