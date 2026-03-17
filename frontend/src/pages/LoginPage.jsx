import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/api';
import { ADMIN_EMAIL } from '../services/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data.user && data.user.email === ADMIN_EMAIL) {
        navigate('/editor');
      } else {
        throw new Error('Unauthorized: You are not an admin.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="glass-panel animate-fade-in login-container">
        <h1 className="neon-text-accent" style={{ margin: 0, fontSize: '2rem' }}>
          Admin Access
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 5 }}>
          Secure portal for Richa Sharma
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              required
              placeholder="admin@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <div className="error-msg" style={{ display: 'block' }}>
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="neon-btn"
            style={{ width: '100%', marginTop: 10 }}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Login to Dashboard'}
          </button>
        </form>

        <div style={{ marginTop: '2rem' }}>
          <Link
            to="/"
            style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            ← Return to Public Site
          </Link>
        </div>
      </div>
    </main>
  );
}
