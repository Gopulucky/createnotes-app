import React from 'react';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`} role="status">
      {toast.message}
    </div>
  );
}
