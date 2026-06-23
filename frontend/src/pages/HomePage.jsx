import { useState, useEffect } from 'react';
import StoryCard from '../components/StoryCard';
import { getPosts, getBookmarks, getAdminProfile } from '../services/api';
import { getCurrentUser } from '../services/auth';

const CATEGORIES = [
  { key: 'story', id: 'recent', title: 'Latest Stories', empty: 'No stories published yet.' },
  { key: 'article', id: 'articles', title: 'Latest Articles', empty: 'No articles published yet.' },
  { key: 'series', id: 'series', title: 'Latest Series', empty: 'No series published yet.' },
  { key: 'comics', id: 'comics', title: 'Latest Comics', empty: 'No comics published yet.' },
  { key: 'drama', id: 'drama', title: 'Latest Drama', empty: 'No drama published yet.' },
  { key: 'wgws', id: 'wgws', title: 'Latest WGWS', empty: 'No WGWS published yet.' },
];

export default function HomePage() {
  const [data, setData] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
  const [profile, setProfile] = useState({ facebook_url: '', instagram_url: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const results = await Promise.all([
          ...CATEGORIES.map((cat) => getPosts(cat.key)),
          getAdminProfile().catch(() => ({ facebook_url: '', instagram_url: '' }))
        ]);
        const dataMap = {};
        CATEGORIES.forEach((cat, i) => {
          dataMap[cat.key] = results[i];
        });
        setData(dataMap);
        setProfile(results[CATEGORIES.length] || { facebook_url: '', instagram_url: '' });

        const user = getCurrentUser();
        if (user) {
          const bookmarksData = await getBookmarks();
          setBookmarks(bookmarksData || []);
        }
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
              {profile.instagram_url ? (
                <a href={profile.instagram_url} target="_blank" rel="noreferrer" className="social-btn">Instagram</a>
              ) : (
                <a href="#" className="social-btn" onClick={(e) => e.preventDefault()}>Instagram</a>
              )}
              {profile.facebook_url ? (
                <a href={profile.facebook_url} target="_blank" rel="noreferrer" className="social-btn">Facebook</a>
              ) : (
                <a href="#" className="social-btn" onClick={(e) => e.preventDefault()}>Facebook</a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bookmarks Section */}
      {bookmarks.length > 0 && (
        <section id="bookmarks" style={{ marginTop: '2rem', marginBottom: '3rem' }}>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>★ Your Bookmarked Stories</span>
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>({bookmarks.length})</span>
          </h2>
          <div className="story-grid animate-fade-in">
            {bookmarks.map((item, idx) => (
              <StoryCard key={item.id} story={item} index={idx} />
            ))}
          </div>
        </section>
      )}

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


    </main>
  );
}
