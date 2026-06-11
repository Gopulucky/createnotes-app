import React, { useEffect, useState } from 'react';

// A mock table of contents based on placeholder headings
const headings = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'key-concepts', title: 'Key Concepts' },
  { id: 'my-notes', title: 'My Notes' },
  { id: 'summary', title: 'Summary' }
];

export default function TableOfContents() {
  const [activeId, setActiveId] = useState('introduction');

  // Wikipedia Pattern: Sticky TOC with active scroll highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, []);

  const handleClick = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <aside className="sidebar right">
      <div className="toc-title">On this page</div>
      <ul className="toc-list">
        {headings.map((heading) => (
          <li key={heading.id} className="toc-item">
            <a 
              href={`#${heading.id}`}
              onClick={(e) => handleClick(e, heading.id)}
              className={`toc-link ${activeId === heading.id ? 'active' : ''}`}
            >
              {heading.title}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
