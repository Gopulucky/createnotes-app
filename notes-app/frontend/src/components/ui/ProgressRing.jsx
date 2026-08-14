import React from 'react';

// A ring drawn around a topic's icon showing how much of the topic is filled in.
// The track is always visible so an empty topic still reads as "0 of 3", not as a
// missing element; the arc grows clockwise from 12 o'clock.
export default function ProgressRing({ fraction, size = 30, children, label, className = '' }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));

  return (
    <span className={`progress-ring ${className}`} style={{ width: size, height: size }} title={label}>
      <svg className="progress-ring-svg" width={size} height={size} aria-hidden="true">
        <circle
          className="progress-ring-track"
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
        />
        {clamped > 0 && (
          <circle
            className="progress-ring-arc"
            cx={size / 2} cy={size / 2} r={r}
            fill="none" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
          />
        )}
      </svg>
      <span className="progress-ring-inner">{children}</span>
    </span>
  );
}
