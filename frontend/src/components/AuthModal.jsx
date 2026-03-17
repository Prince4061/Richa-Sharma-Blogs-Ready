import { useState } from 'react';
import { login, signup } from '../services/api';

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        display: 'flex',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(5px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{ width: '100%', maxWidth: 400, padding: '2rem', position: 'relative' }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 15,
            top: 15,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          &times;
        </button>

        {error && (
          <div
            style={{
              color: '#ff4a4a',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              textAlign: 'center',
              border: '1px solid rgba(255, 74, 74, 0.3)',
              padding: 8,
              borderRadius: 4,
              background: 'rgba(255, 74, 74, 0.1)',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <h2
            className="neon-text-accent"
            style={{ marginTop: 0, fontSize: '1.8rem', textAlign: 'center' }}
          >
            {isLogin ? 'Welcome Back' : 'Join Us'}
          </h2>

          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
            />
          )}

          <input
            type="email"
            placeholder="Email Address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />

          <input
            type="password"
            placeholder={isLogin ? 'Password' : 'Password (min 6 chars)'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />

          <button type="submit" className="neon-btn" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
          </button>

          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 10 }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsLogin(!isLogin);
                setError('');
              }}
              style={{ color: 'var(--accent-neon)', textDecoration: 'none' }}
            >
              {isLogin ? 'Sign up' : 'Login'}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
