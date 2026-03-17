import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPost, getComments, addComment, deletePost } from '../services/api';
import { getCurrentUser, isAdmin } from '../services/auth';
import AuthModal from '../components/AuthModal';

export default function StoryPage() {
  const { id } = useParams();
  const [story, setStory] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const user = getCurrentUser();
  const admin = isAdmin();

  const loadComments = useCallback(async () => {
    try {
      const data = await getComments(id);
      setComments(data || []);
      setCommentCount(data ? data.length : 0);
    } catch {
      setComments([]);
    }
  }, [id]);

  useEffect(() => {
    async function fetchStory() {
      if (!id) {
        setError('Story not found!');
        setLoading(false);
        return;
      }
      try {
        const data = await getPost(id);
        if (!data || data.error) {
          setError('Story not found!');
        } else {
          setStory(data);
          document.title = `${data.title} - Richa Sharma`;
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStory();
    loadComments();
  }, [id, loadComments]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this permanently?')) {
      try {
        await deletePost(id);
        alert('Deleted successfully!');
        window.location.href = '/';
      } catch (err) {
        alert('Delete failed: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await addComment(id, commentText.trim());
      setCommentText('');
      loadComments();
    } catch (err) {
      alert('Failed to post comment: ' + (err.response?.data?.error || err.message));
    } finally {
      setPosting(false);
    }
  };

  const shareStory = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2500);
      });
    }
  };

  if (loading) {
    return (
      <main className="animate-fade-in">
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          Loading story...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="animate-fade-in">
        <div style={{ textAlign: 'center', padding: '4rem', color: '#ff4a4a' }}>{error}</div>
      </main>
    );
  }

  const category = (story.category || 'story').toLowerCase();
  const dateObj = new Date(story.created_at);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const authorName = story.profiles?.name || 'Richa Sharma';

  return (
    <>
      {/* Toast */}
      {toastVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent-neon)',
            color: 'var(--bg-primary)',
            padding: '12px 24px',
            borderRadius: 8,
            fontWeight: 700,
            fontFamily: 'var(--font-main)',
            boxShadow: '0 4px 20px rgba(234,255,0,0.4)',
            zIndex: 9999,
            letterSpacing: 0.5,
          }}
        >
          🔗 Link copied to clipboard!
        </div>
      )}

      <main className="animate-fade-in">
        <article className={`story-article cat-${category}`}>
          {/* Header */}
          <div className="story-header" style={{ textAlign: 'center' }}>
            <span className="story-tag" style={{ marginBottom: 15, display: 'inline-block' }}>
              {story.category || 'Story'}
            </span>
            <h1 className="neon-text">{story.title}</h1>
            <p
              className="story-meta"
              style={{ justifyContent: 'center', gap: 20, fontSize: '1rem', border: 'none', padding: 0 }}
            >
              <span>By {authorName}</span>
              <span>•</span>
              <span>{formattedDate}</span>
            </p>
            {admin && (
              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleDelete}
                  className="neon-btn"
                  style={{ borderColor: '#ff4a4a', color: '#ff4a4a', padding: '5px 15px' }}
                >
                  Delete Post
                </button>
              </div>
            )}
          </div>

          {/* Cover Image */}
          {story.cover_image_url && (
            <img src={story.cover_image_url} alt="Cover" className="story-main-image" />
          )}

          {/* Content */}
          <div dangerouslySetInnerHTML={{ __html: story.content }} />

          {/* Share */}
          <div style={{ marginTop: '3rem', textAlign: 'center' }}>
            <button className="neon-btn" onClick={shareStory}>
              Share This Story
            </button>
          </div>
        </article>

        {/* Comments Section */}
        <section className="comments-section">
          <h2 className="section-title" style={{ fontSize: '1.8rem' }}>
            Reader Thoughts ({commentCount})
          </h2>

          <div className="comments-list">
            {comments.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>
                No comments yet. Be the first to share your thoughts!
              </div>
            ) : (
              comments.map((comment) => {
                const cDate = new Date(comment.created_at);
                const cFormatted = cDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div key={comment.id} className="comment-box">
                    <div className="comment-header">
                      <strong>{comment.profiles?.name || 'Anonymous User'}</strong>
                      <span>{cFormatted}</span>
                    </div>
                    <div
                      className="comment-body"
                      style={{ fontFamily: 'var(--font-hindi), var(--font-main)' }}
                      dangerouslySetInnerHTML={{
                        __html: comment.content.replace(/\n/g, '<br>'),
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Add Comment */}
          {user ? (
            <form className="new-comment-form" onSubmit={handleCommentSubmit}>
              <h3 style={{ marginBottom: 0 }}>Leave a Comment</h3>
              <input
                type="text"
                placeholder="Your Name"
                value={user.name || user.email?.split('@')[0] || ''}
                readOnly
                style={{ opacity: 0.7 }}
              />
              <textarea
                rows="4"
                placeholder="Share your thoughts (English or Hindi)..."
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                style={{ fontFamily: 'var(--font-hindi), var(--font-main)' }}
              />
              <button
                type="submit"
                className="neon-btn"
                style={{ alignSelf: 'flex-start' }}
                disabled={posting}
              >
                {posting ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          ) : (
            <div
              style={{
                textAlign: 'center',
                marginTop: '2rem',
                padding: '2rem',
                border: '1px dashed var(--border-color)',
                borderRadius: 8,
              }}
            >
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Please log in to share your thoughts.
              </p>
              <button className="neon-btn" onClick={() => setShowAuth(true)}>
                Login to Comment
              </button>
            </div>
          )}
        </section>
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
