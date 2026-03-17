import { useNavigate } from 'react-router-dom';
import { isAdmin } from '../services/auth';
import { deletePost } from '../services/api';

export default function StoryCard({ story, index = 0 }) {
  const navigate = useNavigate();
  const admin = isAdmin();
  const delay = (index % 3) + 1;

  const dateObj = new Date(story.created_at);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const imgUrl =
    story.cover_image_url ||
    'https://images.unsplash.com/photo-1455390582262-044cdead2708?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80';

  const category = story.category || 'story';
  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this permanently?')) {
      try {
        await deletePost(story.id);
        alert('Deleted successfully!');
        window.location.reload();
      } catch (err) {
        alert('Delete failed: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  return (
    <article
      className={`story-card animate-fade-in delay-${delay}`}
      data-category={category}
      onClick={() => navigate(`/story/${story.id}`)}
    >
      <div
        className="story-image"
        style={{
          backgroundImage: `url('${imgUrl}')`,
          backgroundPosition: 'center',
          borderBottom: '1px solid var(--border-color)',
        }}
      />
      <div className="story-content">
        <span className="story-tag">{categoryLabel}</span>
        <h3 className="story-title">{story.title}</h3>
        <p className="story-excerpt">{story.excerpt || ''}</p>
        <div className="story-meta">
          <span>
            {formattedDate} • {story.profiles?.name || 'Admin'}
          </span>
          {admin && (
            <button
              onClick={handleDelete}
              style={{
                background: 'rgba(255, 74, 74, 0.1)',
                border: '1px solid #ff4a4a',
                color: '#ff4a4a',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#ff4a4a';
                e.target.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'rgba(255, 74, 74, 0.1)';
                e.target.style.color = '#ff4a4a';
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
