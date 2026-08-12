import React from 'react';
import { useNavigate } from 'react-router-dom';
import { slugify } from '../App';

const EditIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
const TrashIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);

export default function CourseDashboard({ courses, progressState, onDbUpdate, isDarkMode, toggleTheme }) {
  const navigate = useNavigate();

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

  return (
    <div className="dashboard-layout">
      <header className="dashboard-header">
        <h1>COURSES</h1>
        <button className="add-course-btn" onClick={handleAddCourse}>
          + Add New Course
        </button>
      </header>

      <div className="course-grid">
        {courses.map((course) => {
          // Calculate individual course progress
          const totalTopics = course.modules.reduce((acc, curr) => acc + curr.topics.length, 0);
          const completedInCourse = course.modules.reduce((acc, mod) => {
            return acc + mod.topics.filter(t => progressState[t.id] === 'mastered').length;
          }, 0);
          const progressPercent = totalTopics === 0 ? 0 : Math.round((completedInCourse / totalTopics) * 100);

          // We'll use a placeholder gradient since we don't have coverImage uploads yet
          const gradientIndex = course.id.length % 3;
          const bgGradients = [
            'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)', // Indigo (brand)
            'linear-gradient(135deg, #b45309 0%, #92400e 100%)', // Terracotta/amber
            'linear-gradient(135deg, #166534 0%, #14532d 100%)'  // Forest green
          ];

          return (
            <div key={course.id} className="course-card" onClick={() => navigate(`/course/${slugify(course.title)}`)}>
              <div className="course-card-banner" style={{ background: bgGradients[gradientIndex] }}>
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
                <h3 className="course-card-title">{course.title}</h3>
                <p className="course-card-desc">{course.description || "This section contains mentorship & practice session recordings."}</p>
                
                <div className="course-card-progress-wrapper">
                  <span className="course-card-progress-text">{progressPercent}% COMPLETE</span>
                  <div className="course-card-progress-bar">
                    <div className="course-card-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>

                <button className="course-card-btn">Continue</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
