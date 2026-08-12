import React from 'react';
import { Link } from 'react-router-dom';

const BookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
);

const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.6 4.6 0 0 1 1.3-3.3 4.3 4.3 0 0 1 .1-3.2s1-.3 3.4 1.3a11.6 11.6 0 0 1 6.2 0c2.3-1.6 3.3-1.3 3.3-1.3a4.3 4.3 0 0 1 .1 3.2 4.6 4.6 0 0 1 1.3 3.3c0 4.7-2.9 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/></svg>
);

export default function Footer() {
  return (
    <footer className="main-footer">
      <div className="footer-grid">
        <div className="footer-brand-col">
          <div className="footer-brand">
            <BookIcon />
            CreateNotes
          </div>
          <p className="footer-tagline">
            Organize lecture screenshots, notes, and code into structured courses you'll actually remember.
          </p>
          <a
            className="footer-icon-link"
            href="https://github.com/Gopulucky/createnotes-app"
            target="_blank"
            rel="noreferrer"
            title="View source on GitHub"
          >
            <GithubIcon />
          </a>
        </div>

        <div className="footer-col">
          <h4>Product</h4>
          <Link to="/">Dashboard</Link>
          <Link to="/import">Import Screenshots</Link>
        </div>

        <div className="footer-col">
          <h4>Resources</h4>
          <a href="https://github.com/Gopulucky/createnotes-app" target="_blank" rel="noreferrer">GitHub Repository</a>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a free Gemini key</a>
        </div>

        <div className="footer-col">
          <h4>Legal</h4>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} CreateNotes. All rights reserved.</p>
      </div>
    </footer>
  );
}
