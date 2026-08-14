import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { slugify } from '../App';
import Flashcards from './Flashcards';

// Monaco is a multi-MB dependency — only fetch it when the Code tab is actually opened.
const Editor = lazy(() => import('@monaco-editor/react'));

const EMPTY_CONTENT = {
  progress: 'not-started', notes: '', codeNotes: '', images: [],
  keyConcepts: '', flashcards: [], expectedOutput: '', codeMeta: { filename: 'script.js' },
};

// Drives the guided step-flow for the Article tab — one section open at a time,
// in this order, with a sticky "Next" bar walking the user through them.
const ARTICLE_STEPS = [
  { key: 'keyConcepts', label: 'Key Concepts' },
  { key: 'images', label: 'Images & Diagrams' },
  { key: 'notes', label: 'Text Notes' },
];

const EditIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '6px' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const RevealIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ marginRight: '8px' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>);
const HideIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '4px' }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>);
const CopyIcon = () => (<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: '6px' }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const CheckIcon = () => (<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>);

function formatSavedAgo(ts, now) {
  const secs = Math.max(0, Math.round((now - ts) / 1000));
  if (secs < 5) return 'Saved just now';
  if (secs < 60) return `Saved ${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `Saved ${mins}m ago`;
  return `Saved ${Math.round(mins / 60)}h ago`;
}

// One collapsible step in the guided flow. Exactly one step is open at a time — clicking
// a header (open or not) makes it the active one; there's no "all collapsed" state.
function StepSection({ stepKey, num, title, complete, isOpen, onOpen, children }) {
  return (
    <div className={`step-section ${isOpen ? 'open' : ''}`}>
      <button type="button" className="step-section-header" onClick={() => onOpen(stepKey)}>
        <span className={`step-section-marker ${complete ? 'complete' : ''}`}>
          {complete ? <CheckIcon /> : num}
        </span>
        <span className="step-section-title">{title}</span>
        <span className="step-section-chevron">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && <div className="step-section-body">{children}</div>}
    </div>
  );
}

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
  const [openStep, setOpenStep] = useState(ARTICLE_STEPS[0].key);
  const [activeView, setActiveView] = useState('article');

  // Autosave feedback
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { courseSlug } = useParams();

  // Recomputes "Saved Xs ago" periodically so the indicator stays accurate without needing
  // a save to happen.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const showToast = (message, tone = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  // Shared save path for every autosaved field, so one indicator in the top bar reflects
  // saves happening in any of the three tabs (Article / Code / Flashcards).
  const persist = async (url, body) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
  };

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
    setOpenStep(ARTICLE_STEPS[0].key);
    setSaveStatus('idle');
    setLastSavedAt(null);

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

        // Resume where they left off — jump straight to the first unfinished step
        // instead of always restarting at Key Concepts.
        const completion = {
          keyConcepts: !!(data.keyConcepts || '').trim(),
          images: (data.images || []).length > 0,
          notes: !!(data.notes || '').trim(),
        };
        const firstIncomplete = ARTICLE_STEPS.find(s => !completion[s.key]);
        setOpenStep(firstIncomplete ? firstIncomplete.key : ARTICLE_STEPS[0].key);
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

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    persist('/api/notes', { topicId: topic.id, content: localNotes });
  };

  const handleKeyConceptsBlur = () => {
    setIsEditingKeyConcepts(false);
    persist('/api/keyConcepts', { topicId: topic.id, content: localKeyConcepts });
  };

  const handleOutputBlur = () => {
    setIsEditingOutput(false);
    persist('/api/expectedOutput', { topicId: topic.id, content: localExpectedOutput });
  };

  const handleCodeMetaBlur = () => {
    setIsEditingCodeMeta(false);
    persist('/api/codeMeta', { topicId: topic.id, meta: localCodeMeta });
  };

  const handleCodeChange = (value) => {
    setLocalCode(value || '');
  };

  const handleCodeBlur = () => {
    persist('/api/codeNotes', { topicId: topic.id, content: localCode });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('topicId', topic.id);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setLocalImages(data.images || []);
      showToast('Image uploaded');
    } catch (err) {
      console.error('Upload failed', err);
      showToast('Upload failed — try again', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (imageUrl) => {
    if (!confirm("Are you sure you want to remove this image?")) return;
    try {
      const res = await fetch('/api/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, imageUrl })
      });

      if (!res.ok) throw new Error('Delete failed');
      const data = await res.json();
      setLocalImages(data.images || []);
      showToast('Image removed');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete image', 'error');
    }
  };

  const handleCopyCode = () => {
    if (!localCode) return;
    navigator.clipboard.writeText(localCode);
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
        showToast('Exported and committed to Git');
      } else {
        showToast(`Export failed: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Network error during export', 'error');
    }
    setExporting(false);
  };

  const handleFlashcardsSave = (newCards) => {
    setLocalFlashcards(newCards);
    persist('/api/flashcards', { topicId: topic.id, flashcards: newCards });
  };

  const currentStatus = progressState[topic.id] || 'not-started';
  const topicImages = localImages;
  const topicFlashcards = localFlashcards;

  const prevTopic = currentIndex > 0 ? flatTopics[currentIndex - 1] : null;
  const nextTopic = currentIndex < flatTopics.length - 1 ? flatTopics[currentIndex + 1] : null;

  const stepComplete = {
    keyConcepts: !!localKeyConcepts.trim(),
    images: topicImages.length > 0,
    notes: !!localNotes.trim(),
  };
  const currentStepIndex = ARTICLE_STEPS.findIndex(s => s.key === openStep);
  const nextStep = ARTICLE_STEPS[currentStepIndex + 1];

  const goToNextStep = () => {
    if (nextStep) {
      setOpenStep(nextStep.key);
    } else {
      setActiveView('code');
    }
  };

  const saveIndicatorText = saveStatus === 'saving'
    ? 'Saving…'
    : saveStatus === 'error'
    ? 'Save failed'
    : lastSavedAt
    ? formatSavedAgo(lastSavedAt, nowTick)
    : null;

  return (
    <main className="main-content-area print-area">
      <div className="article-main-col">
        {contentLoading && <div className="content-loading-bar" aria-hidden="true" />}

          <h1>{topic.title}</h1>

          <div className="no-print topic-meta-bar">
            <div className="topic-meta-bar-left">
              <span className={`difficulty-badge ${topic.difficulty}`}>{topic.difficulty}</span>
              <div className="status-segmented">
                <button
                  className={currentStatus === 'not-started' ? 'active' : ''}
                  onClick={() => handleStatusChange('not-started')}
                >Not Started</button>
                <button
                  className={currentStatus === 'in-progress' ? 'active' : ''}
                  onClick={() => handleStatusChange('in-progress')}
                >In Progress</button>
                <button
                  className={`mastered ${currentStatus === 'mastered' ? 'active' : ''}`}
                  onClick={() => handleStatusChange('mastered')}
                >Mastered</button>
              </div>
            </div>
            <div className="topic-meta-bar-right">
              {saveIndicatorText && (
                <span className={`save-indicator ${saveStatus}`}>{saveIndicatorText}</span>
              )}
              <button onClick={() => window.print()} className="ghost-btn-sm">Save as PDF</button>
            </div>
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
              <StepSection
                stepKey="keyConcepts" num={1} title="Key Concepts"
                complete={stepComplete.keyConcepts} isOpen={openStep === 'keyConcepts'} onOpen={setOpenStep}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                    placeholder={`List the 3–5 core ideas of "${topic.title}" in your own words...`}
                    value={localKeyConcepts}
                    onChange={(e) => setLocalKeyConcepts(e.target.value)}
                    onBlur={handleKeyConceptsBlur}
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingKeyConcepts(true)}
                    className="markdown-content step-editable"
                  >
                    {localKeyConcepts
                      ? <ReactMarkdown>{localKeyConcepts}</ReactMarkdown>
                      : <span className="step-empty-hint">List the 3–5 core ideas of "{topic.title}" in your own words.</span>}
                  </div>
                )}
              </StepSection>

              <StepSection
                stepKey="images" num={2} title="Images & Diagrams"
                complete={stepComplete.images} isOpen={openStep === 'images'} onOpen={setOpenStep}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="no-print">
                  <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: '8px 16px', background: 'var(--color-brand)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}
                  >
                    + Upload Image
                  </button>
                </div>

                {topicImages.length > 0 ? (
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
                ) : (
                  <p className="step-empty-hint">Add a diagram or screenshot that makes this concept click.</p>
                )}
              </StepSection>

              <StepSection
                stepKey="notes" num={3} title="Text Notes"
                complete={stepComplete.notes} isOpen={openStep === 'notes'} onOpen={setOpenStep}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                    placeholder={`Write a few sentences explaining "${topic.title}" like you're teaching it to someone else...`}
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingNotes(true)}
                    className="markdown-content step-editable"
                  >
                    {localNotes
                      ? <ReactMarkdown>{localNotes}</ReactMarkdown>
                      : <span className="step-empty-hint">Write a few sentences explaining "{topic.title}" like you're teaching it to someone else.</span>}
                  </div>
                )}
              </StepSection>

              <div className="step-next-bar no-print">
                <span className="step-next-progress">Step {currentStepIndex + 1} of {ARTICLE_STEPS.length}</span>
                <button className="step-next-btn" onClick={goToNextStep}>
                  {nextStep ? `Next: ${nextStep.label}` : 'Continue to Code'} →
                </button>
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
      </div>

      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status">{toast.message}</div>
      )}
    </main>
  );
}
