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
        <div className="flashcard-study">
          <p className="flashcard-hint">Press Space to flip, ← / → to navigate</p>

          <div className="flashcard-stage">
            <div
              className="flashcard-scene"
              onClick={() => setIsFlipped(!isFlipped)}
              role="button"
              tabIndex={0}
              aria-label={isFlipped ? 'Show question' : 'Show answer'}
              onKeyDown={(e) => { if (e.key === 'Enter') setIsFlipped(f => !f); }}
            >
              <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                <div className="flashcard-face front">
                  <div className="flashcard-counter">{currentIndex + 1} / {cards.length}</div>
                  <button
                    className="flashcard-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(currentCard.id); }}
                    aria-label="Delete this card"
                    title="Delete card"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                  <h3 className="flashcard-text">{currentCard.front}</h3>
                  <div className="flashcard-flip-hint">See answer</div>
                </div>

                <div className="flashcard-face back">
                  <div className="flashcard-counter">{currentIndex + 1} / {cards.length}</div>
                  <h3 className="flashcard-text">{currentCard.back}</h3>
                </div>
              </div>
            </div>

            <div className="flashcard-nav">
              <button
                className="flashcard-nav-btn"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                aria-label="Previous card"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              </button>

              <button
                className="flashcard-score-btn incorrect"
                onClick={handleIncorrect}
                aria-label={`Mark incorrect (${score.incorrect} so far)`}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                {score.incorrect}
              </button>

              <button
                className="flashcard-score-btn correct"
                onClick={handleCorrect}
                aria-label={`Mark correct (${score.correct} so far)`}
              >
                {score.correct}
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>

              <button
                className="flashcard-nav-btn"
                onClick={handleNext}
                disabled={currentIndex === cards.length - 1}
                aria-label="Next card"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flashcard-empty">
          <p>You have no flashcards for this topic yet. Create one below to start studying.</p>
        </div>
      )}

      <div className="flashcard-create">
        <h3>Create New Flashcard</h3>
        <div className="flashcard-create-row">
          <div className="field">
            <label className="field-label" htmlFor="flashcard-front">Front (Question)</label>
            <input
              id="flashcard-front"
              className="field-input"
              type="text"
              value={newFront}
              onChange={e => setNewFront(e.target.value)}
              placeholder="What is…"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="flashcard-back">Back (Answer)</label>
            <input
              id="flashcard-back"
              className="field-input"
              type="text"
              value={newBack}
              onChange={e => setNewBack(e.target.value)}
              placeholder="It is…"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ marginTop: '16px' }}
          onClick={handleAdd}
          disabled={!newFront.trim() || !newBack.trim()}
        >
          + Add Flashcard
        </button>
      </div>
    </div>
  );
}
