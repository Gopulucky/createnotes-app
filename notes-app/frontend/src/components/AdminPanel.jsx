import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from './ui/ConfirmDialog';
import Toast from './ui/Toast';
import { useToast } from '../hooks/useToast';

export default function AdminPanel({ isAdmin }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/users')
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`Server returned ${res.status}`)))
      .then(setUsers)
      .catch(err => setError(err.message));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <main className="main-content-area">
        <div className="page-message">
          <h2>Admins only</h2>
          <p>You don't have access to this page.</p>
          <button className="btn-secondary" onClick={() => navigate('/')}>Go home</button>
        </div>
      </main>
    );
  }

  const handleDeleteConfirm = async () => {
    const res = await fetch(`/api/admin/users/${deleteTarget.uid}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Could not delete this account (server returned ${res.status}).`);
    }
    setUsers(prev => prev.filter(x => x.uid !== deleteTarget.uid));
    showToast(`Deleted ${deleteTarget.email}`);
  };

  return (
    <main className="main-content-area">
      <h1>Platform Users</h1>
      <p className="page-intro">
        Everyone who has signed in. Each user's courses/notes are private to them — you can't
        see their content, only manage their account.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {!users && !error && <div className="content-loading-bar" aria-label="Loading users" />}

      {users && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Courses</th>
                <th>Last seen</th>
                <th>Joined</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.uid}>
                  <td>
                    <div className="data-table-user">
                      {u.photoURL && <img src={u.photoURL} alt="" className="data-table-avatar" />}
                      <div>
                        <div>{u.displayName || '(no name)'}</div>
                        <div className="data-table-subtext">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-pill ${u.role === 'admin' ? 'admin' : ''}`}>{u.role}</span>
                  </td>
                  <td>{u.courseCount}</td>
                  <td>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}</td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <button className="btn-danger-outline" onClick={() => setDeleteTarget(u)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="page-intro">No other users yet.</p>}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete account"
        message={`Delete ${deleteTarget?.email}'s account and all ${deleteTarget?.courseCount} of their course(s)? This can't be undone.`}
        confirmLabel="Delete account"
        danger
      />

      <Toast toast={toast} />
    </main>
  );
}
