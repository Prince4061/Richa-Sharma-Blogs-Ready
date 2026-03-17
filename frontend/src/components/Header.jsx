import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCurrentUser, isAdmin, logoutUser } from '../services/auth';
import AuthModal from './AuthModal';

export default function Header() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const user = getCurrentUser();
  const admin = isAdmin();
  const location = useLocation();

  return (
    <>
      <header className="glass-panel">
        <div className="logo">
          <img
            src="https://i.ibb.co/sdv2yVRL/unnamed-removebg-preview.png"
            alt="Richa Logo"
            className="logo-circle"
            style={{ objectFit: 'cover', background: 'transparent', padding: 0 }}
          />
          <h1 style={{ fontFamily: 'var(--font-hindi), var(--font-main)' }}>
            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              ऋचा<span className="accent">एं</span>
            </Link>
          </h1>
        </div>

        <nav>
          <ul>
            <li>
              <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                Home
              </Link>
            </li>
            <li><a href="/#recent">Stories</a></li>
            <li><a href="/#articles">Articles</a></li>
            <li><a href="/#series">Series</a></li>
            <li><a href="/#comics">Comics</a></li>
            <li><a href="/#drama">Drama</a></li>
            {admin && (
              <li>
                <Link to="/editor" className="neon-text-accent">
                  Write Story
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="auth-buttons">
          {user ? (
            <>
              <span style={{ color: 'var(--text-secondary)', marginRight: 15, fontSize: '0.9rem' }}>
                Hi, {user.email?.split('@')[0]}
              </span>
              <button
                className="neon-btn"
                onClick={logoutUser}
                style={{ padding: '8px 15px', fontSize: '0.9rem' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="neon-btn"
                onClick={() => setShowAuthModal(true)}
                style={{ padding: '8px 15px', fontSize: '0.9rem' }}
              >
                Login / Sign Up
              </button>
              <Link
                to="/login"
                style={{ marginLeft: 15, fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                Admin
              </Link>
            </>
          )}
        </div>
      </header>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
