import React, { useState, useEffect, useRef } from 'react';

export default function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('focus'); // focus or break
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const minutesRef = useRef(null);
  const secondsRef = useRef(null);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (isRunning && timeLeft === 0) {
      if (mode === 'focus') {
        alert("Focus session complete! Take a break.");
        setMode('break');
        setTimeLeft(5 * 60);
        setIsRunning(false);
      } else {
        alert("Break is over! Time to focus.");
        setMode('focus');
        setTimeLeft(25 * 60);
        setIsRunning(false);
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, mode]);

  // Wheel Event Listeners for Scrolling Time
  useEffect(() => {
    const handleMinWheel = (e) => {
      e.preventDefault();
      if (!isRunning) {
        if (e.deltaY < 0) setTimeLeft(prev => Math.min(prev + 60, 99 * 60 + 59));
        else setTimeLeft(prev => Math.max(prev - 60, 0));
      }
    };
    const handleSecWheel = (e) => {
      e.preventDefault();
      if (!isRunning) {
        if (e.deltaY < 0) setTimeLeft(prev => prev + 1);
        else setTimeLeft(prev => Math.max(prev - 1, 0));
      }
    };

    const minEl = minutesRef.current;
    const secEl = secondsRef.current;
    if (minEl) minEl.addEventListener('wheel', handleMinWheel, { passive: false });
    if (secEl) secEl.addEventListener('wheel', handleSecWheel, { passive: false });

    return () => {
      if (minEl) minEl.removeEventListener('wheel', handleMinWheel);
      if (secEl) secEl.removeEventListener('wheel', handleSecWheel);
    };
  }, [isRunning]);

  const toggleTimer = () => setIsRunning(!isRunning);

  const resetTimer = () => {
    setIsRunning(false);
    if (mode === 'focus') setTimeLeft(25 * 60);
    else setTimeLeft(5 * 60);
  };

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div 
      ref={containerRef}
      className="no-print" 
      style={{ 
        backgroundColor: '#1c1917',
        color: '#f59e0b',
        padding: '24px 20px',
        borderRadius: isFullscreen ? '0px' : 'var(--radius-lg)',
        position: 'relative', 
        overflow: 'hidden', 
        marginBottom: '32px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      
      {/* Center Timer Display */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        {/* Minutes */}
        <div 
          ref={minutesRef}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: isRunning ? 'default' : 'ns-resize', userSelect: 'none' }}
          title={isRunning ? "" : "Scroll up or down to change"}
        >
          <span style={{ fontSize: '4.5rem', fontWeight: 700, color: '#fde8bc', lineHeight: 1, letterSpacing: '-1px' }}>
            {minutes}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#fde8bc', marginTop: '4px', fontWeight: 400, opacity: 0.8 }}>Min</span>
        </div>
        
        {/* Colon */}
        <span style={{ fontSize: '3.5rem', fontWeight: 700, color: '#fde8bc', lineHeight: 1, paddingBottom: '1rem', opacity: 0.8 }}>
          :
        </span>
        
        {/* Seconds */}
        <div 
          ref={secondsRef}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: isRunning ? 'default' : 'ns-resize', userSelect: 'none' }}
          title={isRunning ? "" : "Scroll up or down to change"}
        >
          <span style={{ fontSize: '4.5rem', fontWeight: 700, color: '#fde8bc', lineHeight: 1, letterSpacing: '-1px' }}>
            {seconds}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#fde8bc', marginTop: '4px', fontWeight: 400, opacity: 0.8 }}>Sec</span>
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
        <button 
          onClick={toggleTimer} 
          style={{
            backgroundColor: '#f59e0b', color: '#1c1917', borderRadius: 'var(--radius-full)',
            padding: '8px 24px', fontWeight: 'bold', fontSize: '0.875rem', cursor: 'pointer', border: 'none', flex: 1
          }}
        >
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={resetTimer}
          style={{
            backgroundColor: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: 'var(--radius-full)',
            padding: '8px 24px', fontWeight: 'bold', fontSize: '0.875rem', cursor: 'pointer', flex: 1
          }}
        >
          Reset
        </button>
      </div>
      
    </div>
  );
}
