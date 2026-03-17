import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdmin, logoutUser } from '../services/auth';
import { createPost, uploadImage } from '../services/api';

const DRAFT_KEY = 'richa_story_draft';

export default function EditorPage() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const editorRef = useRef(null);
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('story');
  const [coverImage, setCoverImage] = useState({ url: null, key: null });
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploaded, setCoverUploaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', color: 'var(--accent-neon)' });

  // Protect route
  useEffect(() => {
    if (!admin) {
      navigate('/login');
    }
  }, [admin, navigate]);

  // Restore draft
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.content && editorRef.current) editorRef.current.innerHTML = draft.content;
        if (draft.category) setCategory(draft.category);
        showToast('📝 Draft restored from last session', 'var(--accent-neon)');
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  function showToast(message, color = 'var(--accent-neon)') {
    setToast({ show: true, message, color });
    setTimeout(() => setToast({ show: false, message: '', color: 'var(--accent-neon)' }), 2500);
  }

  function format(command, value) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  function saveDraft() {
    const content = editorRef.current?.innerHTML?.trim() || '';
    if (!title && !content) {
      showToast('Nothing to save!', '#ff4a4a');
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, category }));
    showToast('Draft saved! ✓', 'var(--accent-neon)');
  }

  async function handleCoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const result = await uploadImage(file);
      setCoverImage({ url: result.url, key: result.key });
      setCoverUploaded(true);
    } catch (err) {
      if (err.message?.includes('session has expired')) {
        alert(err.message);
        navigate('/login');
        return;
      }
      alert('Cover upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleInlineImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await uploadImage(file);
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${result.url}" alt="Story Image"><br>`);
    } catch (err) {
      if (err.message?.includes('session has expired')) {
        alert(err.message);
        navigate('/login');
        return;
      }
      alert('Image upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      if (inlineInputRef.current) inlineInputRef.current.value = '';
    }
  }

  async function handlePublish() {
    const content = editorRef.current?.innerHTML?.trim() || '';
    if (!title) {
      alert('Please enter a title before publishing.');
      return;
    }
    if (!content) {
      alert('Please write some content for your story/article.');
      return;
    }

    // Create excerpt
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const excerpt = tempDiv.textContent.substring(0, 150) + '...';

    setPublishing(true);
    try {
      await createPost({
        title,
        category,
        content,
        excerpt,
        cover_image_url: coverImage.url,
        cover_image_key: coverImage.key,
      });
      localStorage.removeItem(DRAFT_KEY);
      alert(`"${title}" published successfully as ${category}!`);
      navigate('/');
    } catch (err) {
      if (err.message?.includes('session has expired')) {
        alert(err.message);
        navigate('/login');
        return;
      }
      alert('Publish failed: ' + (err.response?.data?.error || err.message || 'Unknown error'));
    } finally {
      setPublishing(false);
    }
  }

  if (!admin) return null;

  return (
    <>
      {/* Toast */}
      {toast.show && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.color,
            color: toast.color === 'var(--accent-neon)' ? 'var(--bg-primary)' : '#fff',
            padding: '12px 24px',
            borderRadius: 8,
            fontWeight: 700,
            fontFamily: 'var(--font-main)',
            boxShadow: '0 4px 20px rgba(234,255,0,0.4)',
            zIndex: 9999,
            letterSpacing: 0.5,
          }}
        >
          {toast.message}
        </div>
      )}

      <main className="animate-fade-in">
        <div className="editor-container">
          {/* Editor Header */}
          <div className="editor-header">
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Draft New Story</h2>
            <div style={{ display: 'flex', gap: 15 }}>
              <button className="neon-btn" style={{ background: 'transparent' }} onClick={saveDraft}>
                Save Draft
              </button>
              <button
                className="neon-btn"
                style={{ background: 'var(--accent-neon)', color: 'var(--bg-primary)' }}
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>

          {/* Title */}
          <input
            type="text"
            className="input-title"
            placeholder="कहानी का शीर्षक दर्ज करें (Enter Title)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Cover & Category */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <input
              type="file"
              ref={coverInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCoverUpload}
            />
            <button
              className="neon-btn"
              style={{
                padding: '8px 15px',
                fontSize: '0.85rem',
                ...(coverUploaded
                  ? { background: 'var(--text-secondary)', color: '#000', borderColor: 'transparent' }
                  : {}),
              }}
              onClick={() => coverInputRef.current.click()}
              disabled={coverUploading}
            >
              {coverUploading ? 'Uploading...' : coverUploaded ? 'Cover Image Uploaded!' : '+ Upload Cover Image'}
            </button>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '5px 10px',
                borderRadius: 4,
                outline: 'none',
                flexGrow: 1,
                marginLeft: 10,
              }}
            >
              <option value="story">Publish as Story</option>
              <option value="article">Publish as Article</option>
              <option value="series">Publish as Series</option>
              <option value="comics">Publish as Comics</option>
              <option value="drama">Publish as Drama</option>
            </select>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <button onClick={() => format('bold')}><b>B</b></button>
            <button onClick={() => format('italic')}><i>I</i></button>
            <button onClick={() => format('underline')}><u>U</u></button>
            <span>|</span>
            <button onClick={() => format('justifyLeft')}>Left</button>
            <button onClick={() => format('justifyCenter')}>Center</button>
            <span>|</span>
            <select onChange={(e) => format('formatBlock', e.target.value)} defaultValue="P">
              <option value="P">Paragraph</option>
              <option value="H2">Heading 2</option>
              <option value="H3">Heading 3</option>
            </select>
            <span>|</span>
            <button
              style={{ color: 'var(--accent-neon)', fontWeight: 'bold' }}
              onClick={() => inlineInputRef.current.click()}
            >
              + Insert Image
            </button>
            <input
              type="file"
              ref={inlineInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleInlineImage}
            />
          </div>

          {/* Editor */}
          <div
            className="content-editor"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
          />
        </div>
      </main>
    </>
  );
}
