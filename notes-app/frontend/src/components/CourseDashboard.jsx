import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { slugify } from '../App';
import { useAuth } from '../contexts/AuthContext';

const EditIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const TrashIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);

const BG_GRADIENTS = [
  'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)', // Indigo (brand)
  'linear-gradient(135deg, #b45309 0%, #92400e 100%)', // Terracotta/amber
  'linear-gradient(135deg, #166534 0%, #14532d 100%)'  // Forest green
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'not-started', label: 'Not Started' },
];

const courseStatus = (percent, totalTopics) =>
  totalTopics > 0 && percent === 100 ? 'completed' : percent > 0 ? 'in-progress' : 'not-started';

const ctaLabel = (status) => status === 'completed' ? 'Review' : status === 'in-progress' ? 'Continue' : 'Start';

export default function CourseDashboard({ courses, progressState, onDbUpdate }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState('all');

  const firstName = currentUser?.displayName?.trim().split(' ')[0] || null;

  const handleAddCourse = async () => {
    const title = prompt("Enter new course title (e.g., Sigma 10):");
    if (!title) return;
    const description = prompt("Enter course description:");
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: description || '' })
      });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleEditCourse = async (e, id, currentTitle, currentDesc) => {
    e.stopPropagation();
    const title = prompt("Edit course title:", currentTitle);
    if (!title) return;
    const description = prompt("Edit description:", currentDesc);
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleDeleteCourse = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to completely delete this course and all its modules?")) return;
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      onDbUpdate(await res.json());
    } catch (e) { console.error(e); }
  };

  const coursesWithStats = courses.map((course) => {
    const totalTopics = course.modules.reduce((acc, curr) => acc + curr.topics.length, 0);
    const completedInCourse = course.modules.reduce((acc, mod) => {
      return acc + mod.topics.filter(t => progressState[t.id] === 'mastered').length;
    }, 0);
    const progressPercent = totalTopics === 0 ? 0 : Math.round((completedInCourse / totalTopics) * 100);
    return { course, progressPercent, status: courseStatus(progressPercent, totalTopics) };
  });

  const counts = {
    all: coursesWithStats.length,
    'in-progress': coursesWithStats.filter(c => c.status === 'in-progress').length,
    completed: coursesWithStats.filter(c => c.status === 'completed').length,
    'not-started': coursesWithStats.filter(c => c.status === 'not-started').length,
  };

  const filteredCourses = filter === 'all' ? coursesWithStats : coursesWithStats.filter(c => c.status === filter);

  return (
    <div className="dashboard-layout">
      <header className="dashboard-hero">
        <div>
          <h1>Welcome back{firstName ? `, ${firstName}` : ''}</h1>
          {courses.length > 0 && (
            <p className="dashboard-summary">
              {counts.all} course{counts.all === 1 ? '' : 's'} · {counts.completed} completed · {counts['in-progress']} in progress
            </p>
          )}
        </div>
        <button className="add-course-btn" onClick={handleAddCourse}>
          + Add New Course
        </button>
      </header>

      {courses.length === 0 ? (
        <div className="dashboard-empty-state">
          <h2>No courses yet</h2>
          <p>Add a course to start organizing your notes, or import a folder of lecture screenshots and let AI build one for you.</p>
          <div className="dashboard-empty-actions">
            <button className="add-course-btn" onClick={handleAddCourse}>+ Add New Course</button>
            <Link to="/import" className="import-nav-btn">Import Screenshots</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="dashboard-filters">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={filter === f.key ? 'active' : ''}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <span className="filter-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>

          <div className="course-grid">
            {filteredCourses.map(({ course, progressPercent, status }, i) => (
              <div
                key={course.id}
                className={`course-card status-${status}`}
                onClick={() => navigate(`/course/${slugify(course.title)}`)}
              >
                <div className="course-card-banner" style={{ background: BG_GRADIENTS[i % BG_GRADIENTS.length] }}>
                  <span className="course-card-tag">Access forever</span>
                  <div className="course-card-banner-text">
                    <h2>{course.title}</h2>
                  </div>

                  <div className="course-card-actions">
                    <button onClick={(e) => handleEditCourse(e, course.id, course.title, course.description)}><EditIcon /></button>
                    <button onClick={(e) => handleDeleteCourse(e, course.id)}><TrashIcon /></button>
                  </div>
                </div>

                <div className="course-card-content">
                  <div className="course-card-title-row">
                    <h3 className="course-card-title">{course.title}</h3>
                    {status === 'completed' && <span className="course-status-pill completed">Completed</span>}
                    {status === 'in-progress' && <span className="course-status-pill in-progress">In progress</span>}
                  </div>
                  <p className="course-card-desc">{course.description || "This section contains mentorship & practice session recordings."}</p>

                  <div className="course-card-progress-wrapper">
                    <span className="course-card-progress-text">{progressPercent}% COMPLETE</span>
                    <div className="course-card-progress-bar">
                      <div className={`course-card-progress-fill status-${status}`} style={{ width: `${progressPercent}%` }}></div>
                    </div>
                  </div>

                  <button className="course-card-btn">{ctaLabel(status)}</button>
                </div>
              </div>
            ))}
          </div>

          {filteredCourses.length === 0 && (
            <p className="dashboard-empty-filter">No courses match this filter.</p>
          )}
        </>
      )}
    </div>
  );
}
