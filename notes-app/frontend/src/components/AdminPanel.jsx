import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel({ isAdmin }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [deletingUid, setDeletingUid] = useState(null);
  const navigate = useNavigate();

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
        <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--color-text-tertiary)' }}>
          <h2>Admins only</h2>
          <p>You don't have access to this page.</p>
          <button
            onClick={() => navigate('/')}
            style={{ marginTop: '16px', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: 'var(--text-base)' }}
          >
            Go home
          </button>
        </div>
      </main>
    );
  }

  const handleDelete = async (u) => {
    if (!confirm(`Delete ${u.email}'s account and all ${u.courseCount} of their course(s)? This can't be undone.`)) return;
    setDeletingUid(u.uid);
    try {
      const res = await fetch(`/api/admin/users/${u.uid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || `Server returned ${res.status}`);
      setUsers(prev => prev.filter(x => x.uid !== u.uid));
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <main className="main-content-area">
      <h1>Platform Users</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
        Everyone who has signed in. Each user's courses/notes are private to them — you can't
        see their content, only manage their account.
      </p>

      {error && <div style={{ color: '#ef4444' }}>Error: {error}</div>}
      {!users && !error && <div>Loading…</div>}

      {users && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-primary)', textAlign: 'left' }}>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Courses</th>
                <th style={thStyle}>Last seen</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.uid} style={{ borderBottom: '1px solid var(--color-border-secondary)' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {u.photoURL && <img src={u.photoURL} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />}
                      <div>
                        <div>{u.displayName || '(no name)'}</div>
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600,
                      background: u.role === 'admin' ? 'var(--color-brand)' : 'var(--color-bg-tertiary)',
                      color: u.role === 'admin' ? '#fff' : 'var(--color-text-secondary)',
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={tdStyle}>{u.courseCount}</td>
                  <td style={tdStyle}>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}</td>
                  <td style={tdStyle}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td style={tdStyle}>
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingUid === u.uid}
                        style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #fecaca', color: '#ef4444', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        {deletingUid === u.uid ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p style={{ color: 'var(--color-text-tertiary)' }}>No other users yet.</p>}
        </div>
      )}
    </main>
  );
}

const thStyle = { padding: '10px 12px', color: 'var(--color-text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle = { padding: '10px 12px' };
