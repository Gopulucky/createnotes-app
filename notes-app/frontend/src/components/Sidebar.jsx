import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { slugify } from '../App';

const EditIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const TrashIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);

export default function Sidebar({ courseData, activeTopicId, progressState, onDbUpdate, isDarkMode, toggleTheme, mobileOpen, onCloseMobile }) {
  const [expandedModules, setExpandedModules] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  if (!courseData || !courseData.modules) return null;

  const totalTopics = courseData.modules.reduce((acc, curr) => acc + curr.topics.length, 0);
  const completedTopics = courseData.modules.reduce((acc, mod) => {
    return acc + mod.topics.filter(t => progressState[t.id] === 'mastered').length;
  }, 0);
  const progressPercent = totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100);

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleAddModule = async () => {
    const title = prompt("Enter new module name:");
    if (!title) return;
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: courseData.id, title })
      });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleEditModule = async (e, id, currentTitle) => {
    e.stopPropagation();
    const title = prompt("Edit module name:", currentTitle);
    if (!title || title === currentTitle) return;
    try {
      const res = await fetch(`/api/modules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleDeleteModule = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this module and all its topics?")) return;
    try {
      const res = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleAddTopic = async (e, moduleId) => {
    e.stopPropagation();
    const title = prompt("Enter new topic name:");
    if (!title) return;
    const difficulty = prompt("Enter difficulty (easy, medium, hard):", "easy");
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, title, difficulty: difficulty || 'easy' })
      });
      onDbUpdate(await res.json());
      if (!expandedModules.includes(moduleId)) setExpandedModules(prev => [...prev, moduleId]);
    } catch (e) { console.error(e); }
  };

  const handleEditTopic = async (e, id, currentTitle, currentDiff) => {
    e.stopPropagation();
    const title = prompt("Edit topic name:", currentTitle);
    if (!title) return;
    const difficulty = prompt("Edit difficulty (easy, medium, hard):", currentDiff);
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, difficulty: difficulty || currentDiff })
      });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleDeleteTopic = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this topic?")) return;
    try {
      const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
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
                  <button className="action-btn edit" onClick={(e) => handleEditModule(e, module.id, module.title)}><EditIcon /></button>
                  <button className="action-btn delete" onClick={(e) => handleDeleteModule(e, module.id)}><TrashIcon /></button>
                  <span className="accordion-icon">{isExpanded ? '▴' : '▾'}</span>
                </div>
              </div>
              
              {isExpanded && (
                <div className="accordion-content">
                  {module.topics.map((topic) => {
                    const status = progressState[topic.id] || 'not-started';
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
                          {/* Document icon instead of video play button */}
                          <svg className={`play-icon ${status}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                          <div className="accordion-item-details">
                            <span className="accordion-item-title">{topic.title}</span>
                            <span className="accordion-item-meta">{topic.difficulty || 'note'}</span>
                          </div>
                        </div>
                        
                        <div className="accordion-item-actions">
                          <button className="action-btn edit" onClick={(e) => handleEditTopic(e, topic.id, topic.title, topic.difficulty)}><EditIcon /></button>
                          <button className="action-btn delete" onClick={(e) => handleDeleteTopic(e, topic.id)}><TrashIcon /></button>
                        </div>
                      </div>
                    );
                  })}
                  <button className="add-topic-btn" onClick={(e) => handleAddTopic(e, module.id)}>
                    + Add Topic
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="add-module-btn" onClick={handleAddModule}>
          + Add Module
        </button>
      </div>
    </aside>
  );
}
