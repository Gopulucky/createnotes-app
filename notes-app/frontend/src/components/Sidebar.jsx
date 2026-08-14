import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { slugify } from '../App';
import FormDialog from './ui/FormDialog';
import ConfirmDialog from './ui/ConfirmDialog';
import Toast from './ui/Toast';
import ProgressRing from './ui/ProgressRing';
import { useToast } from '../hooks/useToast';
import { coursePercent, filledCount, topicFraction, topicStatus, COMPLETION_STEPS } from '../lib/completion';

const EditIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const TrashIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);

const DIFFICULTIES = ['easy', 'medium', 'hard'];

export default function Sidebar({ courseData, activeTopicId, completionState, onDbUpdate, isDarkMode, toggleTheme, mobileOpen, onCloseMobile }) {
  const [expandedModules, setExpandedModules] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  // moduleDialog: null | { mode: 'add' } | { mode: 'edit', id }
  const [moduleDialog, setModuleDialog] = useState(null);
  const [moduleFormTitle, setModuleFormTitle] = useState('');
  const [deleteModuleDialog, setDeleteModuleDialog] = useState(null); // null | { id, title }

  // topicDialog: null | { mode: 'add', moduleId } | { mode: 'edit', id }
  const [topicDialog, setTopicDialog] = useState(null);
  const [topicFormTitle, setTopicFormTitle] = useState('');
  const [topicFormDifficulty, setTopicFormDifficulty] = useState('easy');
  const [deleteTopicDialog, setDeleteTopicDialog] = useState(null); // null | { id, title }

  if (!courseData || !courseData.modules) return null;

  const progressPercent = coursePercent(courseData, completionState);

  const toggleModule = (moduleId) => {
    setExpandedModules(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const openAddModule = () => {
    setModuleFormTitle('');
    setModuleDialog({ mode: 'add' });
  };

  const openEditModule = (e, module) => {
    e.stopPropagation();
    setModuleFormTitle(module.title);
    setModuleDialog({ mode: 'edit', id: module.id });
  };

  const handleModuleFormSubmit = async () => {
    const isEdit = moduleDialog.mode === 'edit';
    const res = await fetch(isEdit ? `/api/modules/${moduleDialog.id}` : '/api/modules', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit
        ? { title: moduleFormTitle.trim() }
        : { courseId: courseData.id, title: moduleFormTitle.trim() }),
    });
    if (!res.ok) throw new Error('Could not save the module — please try again.');
    onDbUpdate(await res.json());
    showToast(isEdit ? 'Module updated' : 'Module added');
  };

  const openDeleteModule = (e, module) => {
    e.stopPropagation();
    setDeleteModuleDialog({ id: module.id, title: module.title });
  };

  const handleDeleteModuleConfirm = async () => {
    const res = await fetch(`/api/modules/${deleteModuleDialog.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete the module — please try again.');
    onDbUpdate(await res.json());
    showToast('Module deleted');
  };

  const openAddTopic = (e, moduleId) => {
    e.stopPropagation();
    setTopicFormTitle('');
    setTopicFormDifficulty('easy');
    setTopicDialog({ mode: 'add', moduleId });
  };

  const openEditTopic = (e, topic) => {
    e.stopPropagation();
    setTopicFormTitle(topic.title);
    setTopicFormDifficulty(topic.difficulty || 'easy');
    setTopicDialog({ mode: 'edit', id: topic.id });
  };

  const handleTopicFormSubmit = async () => {
    const isEdit = topicDialog.mode === 'edit';
    const res = await fetch(isEdit ? `/api/topics/${topicDialog.id}` : '/api/topics', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit
        ? { title: topicFormTitle.trim(), difficulty: topicFormDifficulty }
        : { moduleId: topicDialog.moduleId, title: topicFormTitle.trim(), difficulty: topicFormDifficulty }),
    });
    if (!res.ok) throw new Error('Could not save the topic — please try again.');
    onDbUpdate(await res.json());
    showToast(isEdit ? 'Topic updated' : 'Topic added');
    if (!isEdit && !expandedModules.includes(topicDialog.moduleId)) {
      setExpandedModules(prev => [...prev, topicDialog.moduleId]);
    }
  };

  const openDeleteTopic = (e, topic) => {
    e.stopPropagation();
    setDeleteTopicDialog({ id: topic.id, title: topic.title });
  };

  const handleDeleteTopicConfirm = async () => {
    const res = await fetch(`/api/topics/${deleteTopicDialog.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete the topic — please try again.');
    onDbUpdate(await res.json());
    showToast('Topic deleted');
  };

  if (isCollapsed) {
    return (
      <aside className={`sidebar accordion-sidebar no-print ${mobileOpen ? 'mobile-open' : ''}`} style={{ width: '64px', minWidth: '64px', padding: '24px 0', alignItems: 'center', transition: 'width 0.2s ease' }}>
        <button
          onClick={() => setIsCollapsed(false)}
          style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Expand Sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <polyline points="12 15 15 12 12 9"></polyline>
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <>
      <aside className={`sidebar accordion-sidebar no-print ${mobileOpen ? 'mobile-open' : ''}`} style={{ transition: 'width 0.2s ease' }}>

        <div className="course-header" style={{ position: 'relative' }}>
          <button
            className="mobile-sidebar-close no-print"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            title="Close navigation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <button
            onClick={toggleTheme}
            style={{ position: 'absolute', top: '24px', right: '56px', background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
            title="Toggle Dark Mode"
            aria-label="Toggle dark mode"
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-bg-tertiary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            {isDarkMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
          </button>

          <button
            onClick={() => setIsCollapsed(true)}
            style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
            title="Minimize Sidebar"
            aria-label="Minimize sidebar"
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-bg-tertiary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <polyline points="15 15 12 12 15 9"></polyline>
            </svg>
          </button>

          <button
            onClick={() => navigate('/')}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 500, padding: 0 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back to Courses
          </button>

          <h2 className="course-title">{courseData.title}</h2>
          <div className="course-progress-wrapper">
            <div className="course-progress-bar">
              <div className="course-progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <span className="course-progress-text">{progressPercent}%</span>
          </div>
        </div>

        <nav className="accordion-nav">
          {courseData.modules.map((module, index) => {
            const isExpanded = expandedModules.includes(module.id);
            return (
              <div key={module.id} className={`accordion-group ${isExpanded ? 'expanded' : ''}`}>
                <div className="accordion-header" onClick={() => toggleModule(module.id)}>
                  <span className="accordion-title">{index + 1}. {module.title}</span>
                  <div className="accordion-actions">
                    <button className="action-btn edit" onClick={(e) => openEditModule(e, module)} aria-label={`Edit ${module.title}`} title="Edit module"><EditIcon /></button>
                    <button className="action-btn delete" onClick={(e) => openDeleteModule(e, module)} aria-label={`Delete ${module.title}`} title="Delete module"><TrashIcon /></button>
                    <span className="accordion-icon">{isExpanded ? '▴' : '▾'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="accordion-content">
                    {module.topics.map((topic) => {
                      const completion = completionState[topic.id];
                      const status = topicStatus(completion);
                      const done = filledCount(completion);
                      return (
                        <div
                          key={topic.id}
                          className={`accordion-item ${activeTopicId === topic.id ? 'active' : ''}`}
                          onClick={() => {
                            navigate(`/course/${slugify(courseData.title)}/topic/${slugify(topic.title)}`);
                            onCloseMobile?.();
                          }}
                        >
                          <div className="accordion-item-main">
                            {/* Ring shows how many of the 3 Learn steps have content. */}
                            <ProgressRing
                              fraction={topicFraction(completion)}
                              className={status}
                              label={`${done} of ${COMPLETION_STEPS.length} sections filled in`}
                            >
                              <svg className={`play-icon ${status}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                              </svg>
                            </ProgressRing>
                            <div className="accordion-item-details">
                              <span className="accordion-item-title">{topic.title}</span>
                              <span className="accordion-item-meta">
                                {done === COMPLETION_STEPS.length
                                  ? topic.difficulty || 'note'
                                  : `${done}/${COMPLETION_STEPS.length} sections`}
                              </span>
                            </div>
                          </div>

                          <div className="accordion-item-actions">
                            <button className="action-btn edit" onClick={(e) => openEditTopic(e, topic)} aria-label={`Edit ${topic.title}`} title="Edit topic"><EditIcon /></button>
                            <button className="action-btn delete" onClick={(e) => openDeleteTopic(e, topic)} aria-label={`Delete ${topic.title}`} title="Delete topic"><TrashIcon /></button>
                          </div>
                        </div>
                      );
                    })}
                    <button className="add-topic-btn" onClick={(e) => openAddTopic(e, module.id)}>
                      + Add Topic
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="add-module-btn" onClick={openAddModule}>
            + Add Module
          </button>
        </div>
      </aside>

      <FormDialog
        open={!!moduleDialog}
        onClose={() => setModuleDialog(null)}
        onSubmit={handleModuleFormSubmit}
        title={moduleDialog?.mode === 'edit' ? 'Edit module' : 'Add new module'}
        submitLabel={moduleDialog?.mode === 'edit' ? 'Save changes' : 'Add module'}
        canSubmit={moduleFormTitle.trim().length > 0}
      >
        <div className="field">
          <label className="field-label" htmlFor="module-title-input">Module name</label>
          <input
            id="module-title-input"
            className="field-input"
            value={moduleFormTitle}
            onChange={(e) => setModuleFormTitle(e.target.value)}
            placeholder="e.g. Sorting Algorithms"
            autoFocus
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteModuleDialog}
        onClose={() => setDeleteModuleDialog(null)}
        onConfirm={handleDeleteModuleConfirm}
        title="Delete module"
        message={`Delete "${deleteModuleDialog?.title}" and all its topics? This can't be undone.`}
        confirmLabel="Delete module"
        danger
      />

      <FormDialog
        open={!!topicDialog}
        onClose={() => setTopicDialog(null)}
        onSubmit={handleTopicFormSubmit}
        title={topicDialog?.mode === 'edit' ? 'Edit topic' : 'Add new topic'}
        submitLabel={topicDialog?.mode === 'edit' ? 'Save changes' : 'Add topic'}
        canSubmit={topicFormTitle.trim().length > 0}
      >
        <div className="field">
          <label className="field-label" htmlFor="topic-title-input">Topic name</label>
          <input
            id="topic-title-input"
            className="field-input"
            value={topicFormTitle}
            onChange={(e) => setTopicFormTitle(e.target.value)}
            placeholder="e.g. Merge Sort"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="topic-difficulty-input">Difficulty</label>
          <select
            id="topic-difficulty-input"
            className="field-select"
            value={topicFormDifficulty}
            onChange={(e) => setTopicFormDifficulty(e.target.value)}
          >
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTopicDialog}
        onClose={() => setDeleteTopicDialog(null)}
        onConfirm={handleDeleteTopicConfirm}
        title="Delete topic"
        message={`Delete "${deleteTopicDialog?.title}"? This can't be undone.`}
        confirmLabel="Delete topic"
        danger
      />

      <Toast toast={toast} />
    </>
  );
}
