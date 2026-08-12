import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar({ isDarkMode, toggleTheme, isAdmin }) {
  const { currentUser, loginWithGoogle, logout } = useAuth();

  const handleAuthAction = async () => {
    try {
      if (currentUser) {
        await logout();
      } else {
        await loginWithGoogle();
      }
    } catch (error) {
      console.error("Auth error:", error);
    }
  };

  return (
    <nav className="main-navbar">
      <div className="navbar-brand">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="logo-icon">📚</div>
          <h2>CreateNotes</h2>
        </Link>
      </div>

      <div className="navbar-actions">
        {currentUser && (
          <>
            <Link to="/import" className="import-nav-btn" title="Import from screenshots">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Import
            </Link>
            {isAdmin && (
              <Link to="/admin" className="import-nav-btn" title="Platform users">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Users
              </Link>
            )}
            <div className="user-info">
              <img src={currentUser.photoURL || 'https://via.placeholder.com/32'} alt="User Avatar" className="user-avatar" />
              <span className="user-name">{currentUser.displayName || currentUser.email}</span>
            </div>
          </>
        )}

        <button className="auth-btn" onClick={handleAuthAction}>
          {currentUser ? 'Logout' : 'Login with Google'}
        </button>

        <button 
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title="Toggle Dark Mode"
        >
          {isDarkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>
      </div>
    </nav>
  );
}
