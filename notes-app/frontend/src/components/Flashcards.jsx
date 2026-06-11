import React, { useState, useEffect } from 'react';

export default function Flashcards({ flashcards, onSave }) {
  const [cards, setCards] = useState(flashcards || []);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  
  // Carousel State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });

  const handleAdd = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    const newCards = [...cards, { id: Date.now(), front: newFront, back: newBack }];
    setCards(newCards);
    setNewFront('');
    setNewBack('');
    onSave(newCards);
    if (cards.length === 0) {
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  };

  const handleDelete = (id) => {
    const newCards = cards.filter(c => c.id !== id);
    setCards(newCards);
    onSave(newCards);
    if (currentIndex >= newCards.length && newCards.length > 0) {
      setCurrentIndex(newCards.length - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleCorrect = () => {
    setScore(s => ({ ...s, correct: s.correct + 1 }));
    handleNext();
  };

  const handleIncorrect = () => {
    setScore(s => ({ ...s, incorrect: s.incorrect + 1 }));
    handleNext();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (cards.length === 0) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(f => !f);
      } else if (e.code === 'ArrowRight') {
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, cards.length]);

  const currentCard = cards[currentIndex];

  return (
    <div id="flashcards" className="no-print" style={{ marginBottom: '40px' }}>
      <h2>Interactive Flashcards</h2>

      {cards.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', marginBottom: '16px' }}>
            Press "Space" to flip, "← / →" to navigate
          </p>

          {/* Glow Wrapper */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '600px',
            background: 'linear-gradient(to right, rgba(230,230,255,0.1), rgba(220,255,230,0.1))',
            borderRadius: '24px',
            padding: '24px 0'
          }}>
            {/* The 3D Card */}
            <div 
              style={{ perspective: '1000px', height: '350px', position: 'relative', cursor: 'pointer', margin: '0 auto', width: '90%' }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div style={{
                width: '100%', height: '100%', position: 'absolute', transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)', transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}>
                {/* Front (Dark) */}
                <div style={{
                  width: '100%', height: '100%', position: 'absolute', backfaceVisibility: 'hidden',
                  background: '#2d2d2d', color: '#f8fafc', borderRadius: '24px',
                  padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ position: 'absolute', top: '24px', left: '24px', color: '#94a3b8', fontSize: '0.875rem' }}>
                    {currentIndex + 1} / {cards.length}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(currentCard.id); }}
                    style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    title="Delete Card"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                  </button>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 400, lineHeight: 1.4, margin: 0, maxWidth: '90%' }}>
                    {currentCard.front}
                  </h3>
                  <div style={{ position: 'absolute', bottom: '24px', color: '#94a3b8', fontSize: '0.875rem' }}>
                    See answer
                  </div>
                </div>
                
                {/* Back (Light) */}
                <div style={{
                  width: '100%', height: '100%', position: 'absolute', backfaceVisibility: 'hidden',
                  background: '#ffffff', color: '#0f172a', borderRadius: '24px',
                  padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  transform: 'rotateY(180deg)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ position: 'absolute', top: '24px', left: '24px', color: '#64748b', fontSize: '0.875rem' }}>
                    {currentIndex + 1} / {cards.length}
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 400, lineHeight: 1.5, margin: 0, maxWidth: '90%' }}>
                    {currentCard.back}
                  </h3>
                  <div style={{ position: 'absolute', bottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    Explain
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Row */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
              <button 
                onClick={handlePrev}
                disabled={currentIndex === 0}
                style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--color-border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', color: currentIndex === 0 ? 'var(--color-border-primary)' : 'var(--color-text-secondary)', transition: 'all 0.2s' }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              </button>

              <button 
                onClick={handleIncorrect}
                style={{ height: '48px', padding: '0 24px', borderRadius: '24px', background: 'transparent', border: '1px solid #fecaca', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                {score.incorrect}
              </button>

              <button 
                onClick={handleCorrect}
                style={{ height: '48px', padding: '0 24px', borderRadius: '24px', background: 'transparent', border: '1px solid #bbf7d0', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#f0fdf4'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {score.correct}
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>

              <button 
                onClick={handleNext}
                disabled={currentIndex === cards.length - 1}
                style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex === cards.length - 1 ? 'not-allowed' : 'pointer', color: currentIndex === cards.length - 1 ? 'var(--color-border-primary)' : 'var(--color-brand)', transition: 'all 0.2s' }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--color-bg-secondary)', borderRadius: '12px', marginBottom: '24px', border: '1px dashed var(--color-border-secondary)' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0' }}>You have no flashcards for this topic yet. Create one below to start studying!</p>
        </div>
      )}

      {/* Creation UI */}
      <div style={{ background: 'var(--color-bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--color-border-primary)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Create New Flashcard</h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>Front (Question)</label>
            <input 
              type="text" 
              value={newFront} 
              onChange={e => setNewFront(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none' }}
              placeholder="What is..."
            />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>Back (Answer)</label>
            <input 
              type="text" 
              value={newBack} 
              onChange={e => setNewBack(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none' }}
              placeholder="It is..."
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
        </div>
        <button 
          onClick={handleAdd}
          disabled={!newFront.trim() || !newBack.trim()}
          style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: (!newFront.trim() || !newBack.trim()) ? 'not-allowed' : 'pointer', opacity: (!newFront.trim() || !newBack.trim()) ? 0.5 : 1, transition: 'all 0.2s' }}
        >
          + Add Flashcard
        </button>
      </div>
    </div>
  );
}
