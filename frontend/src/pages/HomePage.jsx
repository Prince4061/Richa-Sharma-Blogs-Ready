import { useState, useEffect } from 'react';
import StoryCard from '../components/StoryCard';
import { getPosts } from '../services/api';

const CATEGORIES = [
  { key: 'story', id: 'recent', title: 'Latest Stories', empty: 'No stories published yet.' },
  { key: 'article', id: 'articles', title: 'Latest Articles', empty: 'No articles published yet.' },
  { key: 'series', id: 'series', title: 'Latest Series', empty: 'No series published yet.' },
  { key: 'comics', id: 'comics', title: 'Latest Comics', empty: 'No comics published yet.' },
  { key: 'drama', id: 'drama', title: 'Latest Drama', empty: 'No drama published yet.' },
];

export default function HomePage() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const results = await Promise.all(
          CATEGORIES.map((cat) => getPosts(cat.key))
        );
        const dataMap = {};
        CATEGORIES.forEach((cat, i) => {
          dataMap[cat.key] = results[i];
        });
        setData(dataMap);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  return (
    <main>
      {/* Hero Section */}
      <section
        className="hero"
        style={{ padding: '4rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '3rem' }}
      >
        <div className="hero-container">
          <div className="hero-text">
            <h2 className="neon-text" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              विचार, किस्से और हकीकत
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1.2rem',
                maxWidth: 600,
                margin: '0 auto',
              }}
            >
              ऋचा शर्मा के नज़रों से शब्दों की इस खूबसूरत दुनिया को महसूस करें। हिंदी और अंग्रेज़ी की
              दिलकश कहानियों में खुद को खो जाने दें।
            </p>
          </div>
          <div className="hero-image-col animate-fade-in delay-1">
            <img
              src="https://i.ibb.co/C3gtf7hj/Screenshot-2026-03-06-224638.jpg"
              alt="Richa Sharma"
              className="hero-profile-img"
            />
            <h3 className="neon-text" style={{ margin: 0, fontSize: '1.8rem', letterSpacing: 1 }}>
              Richa <span className="neon-text-accent">Sharma</span>
            </h3>
            <div className="hero-socials">
              <a href="#" target="_blank" rel="noreferrer" className="social-btn">Instagram</a>
              <a href="#" target="_blank" rel="noreferrer" className="social-btn">Facebook</a>
            </div>
          </div>
        </div>
      </section>

      {/* Category Grids */}
      {CATEGORIES.map((cat) => (
        <section key={cat.key} id={cat.id} style={cat.key !== 'story' ? { marginTop: '4rem' } : {}}>
          <h2 className="section-title">{cat.title}</h2>
          <div className="story-grid">
            {loading ? (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '2rem', color: 'var(--text-secondary)' }}>
                Loading {cat.key}...
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '2rem', color: '#ff4a4a' }}>
                Failed to load content. {error}
              </div>
            ) : !data[cat.key] || data[cat.key].length === 0 ? (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '2rem', color: 'var(--text-secondary)' }}>
                {cat.empty}
              </div>
            ) : (
              data[cat.key].map((item, idx) => (
                <StoryCard key={item.id} story={item} index={idx} />
              ))
            )}
          </div>
        </section>
      ))}

      {/* Archives Section */}
      <section id="history" style={{ marginTop: '5rem' }}>
        <h2 className="section-title">From the Archives</h2>
        <div className="story-grid" style={{ opacity: 0.8 }}>
          <article
            className="story-card animate-fade-in"
            onClick={() => (window.location.href = '/story/4')}
          >
            <div
              className="story-image"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1476842634003-7dcca8f832de?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80')",
              }}
            />
            <div className="story-content">
              <span className="story-tag" style={{ backgroundColor: '#555' }}>Classic</span>
              <h3 className="story-title">The First Drafts</h3>
              <p className="story-excerpt">
                Looking back at where it all began, the messy scribbles that turned into complete novels.
              </p>
              <div className="story-meta">
                <span>Dec 15, 2025</span>
                <span>4 min read</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
