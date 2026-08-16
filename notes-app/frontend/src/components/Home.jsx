import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Footer from './Footer';
import './Home.css';

const BookIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FEATURES = [
  {
    icon: '📚',
    title: 'Course-based organization',
    desc: 'Group topics into modules and courses, just like a real curriculum — not one giant pile of notes.',
  },
  {
    icon: '✨',
    title: 'AI-powered import',
    desc: 'Paste a free Gemini API key and drop in a folder of lecture screenshots. It writes notes, key concepts, code, and flashcards for you.',
  },
  {
    icon: '🗂️',
    title: 'Flashcards, right where you study',
    desc: 'Flip through auto-generated or custom flashcards next to the topic they belong to — no separate app to juggle.',
  },
  {
    icon: '🧭',
    title: 'A guided path through every topic',
    desc: 'Key concepts, visual examples, then the lesson — one step at a time, with progress tracked automatically as you fill each one in.',
  },
];

export default function Home({ isDarkMode, toggleTheme }) {
  const { loginWithGoogle, error } = useAuth();

  return (
    <div className={`home-page ${isDarkMode ? 'dark' : ''}`}>
      <div className="home-shape home-shape-1"></div>
      <div className="home-shape home-shape-2"></div>

      <nav className="home-nav">
        <div className="home-nav-brand">
          <BookIcon />
          CreateNotes
        </div>
        <div className="home-nav-actions">
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
          <button className="home-nav-signin" onClick={loginWithGoogle}>Sign In</button>
        </div>
      </nav>

      <section className="home-hero">
        <span className="home-eyebrow">Free, forever, for everyone</span>
        <h1>Turn scattered screenshots into a course you'll actually remember.</h1>
        <p className="home-subtitle">
          CreateNotes organizes your lecture screenshots, notes, and code into structured courses —
          with AI-powered import, guided lessons, and flashcards, all in one private place.
        </p>

        {error && (
          <div className="home-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button className="home-cta-btn" onClick={loginWithGoogle}>
          <GoogleIcon />
          Log in with Google
        </button>
        <p className="home-hero-note">No separate account to create — your notes stay private to you.</p>
      </section>

      <section className="home-features">
        <div className="home-features-inner">
          <h2>Everything you need to actually retain what you learn</h2>
          <div className="home-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="home-feature-card">
                <div className="home-feature-icon" aria-hidden="true">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
