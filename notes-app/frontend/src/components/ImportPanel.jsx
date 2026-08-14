import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ImportPanel({ courses, onImportComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [courseId, setCourseId] = useState(courses?.[0]?.id || '');
  const [files, setFiles] = useState([]);
  const [pickWarning, setPickWarning] = useState('');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  const folderInputRef = useRef(null);
  const filesInputRef = useRef(null);
  const navigate = useNavigate();

  // webkitdirectory/directory as plain JSX attributes (webkitdirectory="") are unreliable in
  // React — they can silently fail to reach the DOM. Setting them as DOM properties via a ref
  // is the version that actually works across React versions.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.webkitdirectory = true;
      folderInputRef.current.directory = true;
    }
  }, []);

  const imageFiles = (fileList) =>
    Array.from(fileList).filter(f => /\.(png|jpe?g|webp)$/i.test(f.name));

  const handlePick = (e) => {
    const picked = imageFiles(e.target.files);
    setFiles(picked);
    setPickWarning(
      e.target.files.length === 0
        ? ''
        : picked.length === 0
        ? `Selected ${e.target.files.length} file(s), but none were .png/.jpg/.webp images.`
        : ''
    );
    e.target.value = ''; // allow re-selecting the same folder/files later without it being a no-op
  };

  const canSubmit = apiKey.trim() && courseId && files.length > 0 && !running;

  const handleSubmit = async () => {
    setRunning(true);
    setLog([]);
    setDone(null);
    setError(null);

    const formData = new FormData();
    formData.append('apiKey', apiKey);
    formData.append('moduleName', moduleName);
    formData.append('courseId', courseId);
    files.forEach(f => formData.append('images', f, f.name));

    try {
      const res = await fetch('/api/import/generate', { method: 'POST', body: formData });
      if (!res.body) throw new Error('Streaming not supported by this browser');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === 'error') {
            setError(evt.message);
          } else if (evt.type === 'done') {
            setDone(evt);
            onImportComplete?.();
          } else {
            setLog(prev => [...prev, evt.message || JSON.stringify(evt)]);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      // The key only ever lived in this component's state and the one request above —
      // clear it now so it isn't sitting in memory/DOM any longer than necessary.
      setApiKey('');
      setRunning(false);
    }
  };

  return (
    // Deliberately NOT .main-content-area — that class is a 100vh internal scroll container
    // built for the article/sidebar layout, and under the navbar it pushes this form's lower
    // half (file pickers + submit) out of reach. This page just wants normal document flow.
    <main className="import-page">
      <div className="import-inner">
        <h1>Import from Screenshots</h1>
        <p className="page-intro">
          Pick a folder of lecture screenshots and a free Gemini API key — it'll group them into
          topics and write notes, key concepts, code, and flashcards automatically.
        </p>

        <div className="import-form">
          <div className="field">
            <label className="field-label" htmlFor="import-api-key">Gemini API key</label>
            <input
              id="import-api-key"
              className="field-input"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste your key here"
              autoComplete="off"
            />
            <p className="field-help">
              Not stored anywhere — used only for this import, then discarded. Get a free key at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.
            </p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="import-course">Course</label>
            <select id="import-course" className="field-select" value={courseId} onChange={e => setCourseId(e.target.value)}>
              {(courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="import-module">Module name (optional)</label>
            <input
              id="import-module"
              className="field-input"
              type="text"
              value={moduleName}
              onChange={e => setModuleName(e.target.value)}
              placeholder="Leave blank to auto-detect modules"
            />
            <p className="field-help">
              Leave this blank for a mixed batch (e.g. a whole DSA playlist) and it will split the
              screenshots into separate modules by concept — Sorting, Linked Lists, Backtracking, and
              so on. Fill it in to force everything into one module instead.
            </p>
          </div>

          <div className="field">
            <span className="field-label">Screenshots</span>
            <div className="import-picker-row">
              <input ref={folderInputRef} type="file" multiple onChange={handlePick} style={{ display: 'none' }} />
              <input ref={filesInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handlePick} style={{ display: 'none' }} />
              <button type="button" className="btn-secondary" onClick={() => folderInputRef.current?.click()}>Select folder</button>
              <button type="button" className="btn-secondary" onClick={() => filesInputRef.current?.click()}>Select files</button>
            </div>
            <p className={`import-file-status ${files.length > 0 ? 'has-files' : ''}`}>
              {files.length > 0 ? `${files.length} images selected` : 'No screenshots selected yet'}
            </p>
            {pickWarning && <p className="import-warning">{pickWarning}</p>}
            <p className="field-help">
              "Select folder" needs a Chromium-based browser (Chrome, Edge). Use "Select files" on Firefox/Safari
              — you can select every screenshot at once with Ctrl/Cmd+A inside the picker.
            </p>
          </div>

          <button className="btn-primary import-submit" onClick={handleSubmit} disabled={!canSubmit}>
            {running ? 'Importing…' : 'Start Import'}
          </button>
        </div>

        {(log.length > 0 || error || done) && (
          <div className="import-progress" role="status" aria-live="polite">
            {log.map((l, i) => <div key={i} className="import-log-line">{l}</div>)}
            {error && <div className="alert alert-error" style={{ marginTop: '8px', marginBottom: 0 }}>{error}</div>}
            {done && (
              <div className="import-done">
                <div className="import-done-headline">
                  Done — added {done.moduleCount} module{done.moduleCount === 1 ? '' : 's'} with {done.topicCount} topics.
                </div>
                {done.modules?.length > 0 && (
                  <ul className="import-done-list">
                    {done.modules.map((m, i) => (
                      <li key={i}>{m.title} — {m.topicCount} topic{m.topicCount === 1 ? '' : 's'}</li>
                    ))}
                  </ul>
                )}
                <button className="btn-secondary" style={{ marginTop: '12px' }} onClick={() => navigate('/')}>Go to dashboard</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
