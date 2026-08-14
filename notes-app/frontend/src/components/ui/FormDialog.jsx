import React, { useState } from 'react';
import Modal from './Modal';

// Replaces window.prompt() — shared modal chrome (title, Cancel/Submit, Enter-to-submit,
// submit-button loading state, inline error on failure) around caller-supplied fields.
// Deliberately not a field-config abstraction: each call site owns its own field markup,
// since course/module/topic forms don't share a field shape.
export default function FormDialog({
  open, onClose, onSubmit, title, children,
  submitLabel = 'Save', canSubmit = true,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="modal-form">
        {children}
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer modal-form-footer">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting || !canSubmit}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
