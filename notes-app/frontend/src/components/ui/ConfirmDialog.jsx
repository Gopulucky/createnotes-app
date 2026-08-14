import React, { useState } from 'react';
import Modal from './Modal';

// Replaces window.confirm() — same "are you sure" shape, but styled, accessible,
// and able to show a loading state while the (usually async) action is in flight.
export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
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
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={submitting}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="modal-message">{message}</p>
      {error && <p className="modal-error">{error}</p>}
    </Modal>
  );
}
