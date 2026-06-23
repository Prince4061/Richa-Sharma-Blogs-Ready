import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAdmin, getCurrentUser } from '../services/auth';
import { createPost, updatePost, getPost, getPosts, deletePost, uploadImage, getAdminProfile, updateAdminProfile, getUsers, toggleBlockUser } from '../services/api';

const DRAFT_KEY = 'richa_story_draft';

export default function EditorPage() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const editorRef = useRef(null);
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const draggedImageRef = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('story');
  const [coverImage, setCoverImage] = useState({ url: null, key: null });
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploaded, setCoverUploaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', color: 'var(--accent-neon)' });
  const [draftsList, setDraftsList] = useState([]);
  const [initialContent, setInitialContent] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [resizerRect, setResizerRect] = useState(null);
  const savedRangeRef = useRef(null);

  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [activeTab, setActiveTab] = useState('write');

  useEffect(() => {
    if (editId) {
      setActiveTab('write');
    }
  }, [editId]);

  // Protect route
  useEffect(() => {
    if (!admin) {
      navigate('/login');
    }
  }, [admin, navigate]);

  // Track selection changes to remember cursor position
  useEffect(() => {
    const handleSelectionChange = () => {
      if (editorRef.current) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            savedRangeRef.current = range.cloneRange();
          }
        }
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } else {
      editorRef.current?.focus();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  // Load server-side drafts
  const fetchServerDrafts = async () => {
    if (!admin) return;
    try {
      const data = await getPosts('all', 'draft');
      setDraftsList(data || []);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
    }
  };

  useEffect(() => {
    fetchServerDrafts();
  }, [admin, editId]);

  // Helper to ensure all images in the editor have draggable="true"
  const ensureImagesDraggable = () => {
    if (editorRef.current) {
      const imgs = editorRef.current.getElementsByTagName('img');
      for (let img of imgs) {
        if (!img.getAttribute('draggable')) {
          img.setAttribute('draggable', 'true');
        }
      }
    }
  };

  // Load story details if editing
  useEffect(() => {
    async function loadStory() {
      if (!editId) return;
      try {
        const storyData = await getPost(editId);
        if (storyData) {
          setTitle(storyData.title);
          setCategory(storyData.category);
          setCoverImage({ url: storyData.cover_image_url, key: storyData.cover_image_key });
          setCoverUploaded(!!storyData.cover_image_url);
          setInitialContent(storyData.content || '');
          if (editorRef.current) {
            editorRef.current.innerHTML = storyData.content || '';
            ensureImagesDraggable();
          }
          showToast(`Loaded "${storyData.title}" for editing`, 'var(--accent-neon)');
        }
      } catch (err) {
        showToast('Failed to load story: ' + err.message, '#ff4a4a');
      }
    }
    loadStory();
  }, [editId]);

  // Restore local draft fallback (only if not editing server story)
  useEffect(() => {
    if (editId) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.category) setCategory(draft.category);
        setInitialContent(draft.content || '');
        if (draft.content && editorRef.current) {
          editorRef.current.innerHTML = draft.content;
          ensureImagesDraggable();
        }
        showToast('📝 Local draft restored', 'var(--accent-neon)');
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, [editId]);

  function showToast(message, color = 'var(--accent-neon)') {
    setToast({ show: true, message, color });
    setTimeout(() => setToast({ show: false, message: '', color: 'var(--accent-neon)' }), 2500);
  }

  // Load admin profile settings on mount
  useEffect(() => {
    async function loadAdminProfile() {
      if (!admin) return;
      try {
        const profile = await getAdminProfile();
        if (profile) {
          setInstagramUrl(profile.instagram_url || '');
          setFacebookUrl(profile.facebook_url || '');
        }
      } catch (err) {
        console.error('Failed to load admin profile:', err);
      }
    }
    loadAdminProfile();
  }, [admin]);

  const fetchUsers = async () => {
    if (!admin) return;
    setLoadingUsers(true);
    try {
      const data = await getUsers();
      setUsersList(data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [admin]);

  const handleSaveSocials = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateAdminProfile({
        instagram_url: instagramUrl,
        facebook_url: facebookUrl
      });
      showToast('✅ Social links updated successfully', 'var(--accent-neon)');
    } catch (err) {
      showToast('❌ Failed to update links: ' + (err.response?.data?.error || err.message), '#ff4a4a');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleBlock = async (userId, userEmail) => {
    const actionText = usersList.find(u => u.id === userId)?.status === 'blocked' ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${actionText} ${userEmail}?`)) {
      return;
    }
    try {
      await toggleBlockUser(userId);
      showToast(`User status updated to ${actionText}ed`, 'var(--accent-neon)');
      fetchUsers();
    } catch (err) {
      showToast('Error updating block state: ' + (err.response?.data?.error || err.message), '#ff4a4a');
    }
  };

  function format(command, value) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  // Local fallback draft saving
  function saveDraftLocal() {
    const content = editorRef.current?.innerHTML?.trim() || '';
    if (!title && !content) {
      showToast('Nothing to save!', '#ff4a4a');
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, category }));
    showToast('Saved to browser storage ✓', 'var(--accent-neon)');
  }

  // Server-side draft saving
  async function handleSaveDraftServer() {
    const content = editorRef.current?.innerHTML?.trim() || '';
    if (!title) {
      alert('Please enter a title to save draft on server.');
      return;
    }

    // Create excerpt
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const excerpt = tempDiv.textContent.substring(0, 150) + '...';

    setPublishing(true);
    try {
      const postData = {
        title,
        category,
        content,
        excerpt,
        cover_image_url: coverImage.url,
        cover_image_key: coverImage.key,
        status: 'draft',
      };

      if (editId) {
        await updatePost(editId, postData);
        showToast('Draft updated on server! ✓', 'var(--accent-neon)');
      } else {
        const newPost = await createPost(postData);
        setSearchParams({ edit: String(newPost.id) });
        showToast('Draft saved to server! ✓', 'var(--accent-neon)');
      }
      localStorage.removeItem(DRAFT_KEY);
      fetchServerDrafts();
    } catch (err) {
      if (err.message?.includes('expired')) {
        alert(err.message);
        navigate('/login');
        return;
      }
      alert('Save draft failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setPublishing(false);
    }
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
      if (err.message?.includes('expired')) {
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

    // Save selection range before async upload
    if (editorRef.current) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange();
        }
      }
    }

    try {
      const result = await uploadImage(file);
      
      // Restore selection after upload completes
      restoreSelection();

      // Create the image element programmatically
      const img = document.createElement('img');
      img.src = result.url;
      img.alt = 'Story Image';
      img.setAttribute('draggable', 'true');
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '10px auto';

      const br = document.createElement('br');

      // Insert at selection range
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        
        // Insert elements
        range.insertNode(br);
        range.insertNode(img);

        // Move cursor after the br
        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        
        // Save selection state
        savedRangeRef.current = newRange.cloneRange();
      }

      // Ensure images are draggable
      ensureImagesDraggable();

      // Auto-select the newly inserted image to show resizer immediately!
      setTimeout(() => {
        setSelectedImage(img);
        const rect = img.getBoundingClientRect();
        const container = img.closest('.editor-container');
        if (container) {
          const parentRect = container.getBoundingClientRect();
          setResizerRect({
            top: rect.top - parentRect.top,
            left: rect.left - parentRect.left,
            width: rect.width,
            height: rect.height,
          });
        }
      }, 50);
    } catch (err) {
      if (err.message?.includes('expired')) {
        alert(err.message);
        navigate('/login');
        return;
      }
      alert('Image upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      if (inlineInputRef.current) inlineInputRef.current.value = '';
    }
  }

  function handleInsertImageUrl() {
    const url = prompt('Enter Image URL (e.g., https://example.com/image.jpg):');
    if (!url) return;

    restoreSelection();
    
    // Create the image element programmatically
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Story Image';
    img.setAttribute('draggable', 'true');
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '10px auto';

    const br = document.createElement('br');

    // Insert at selection range
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      
      // Insert elements
      range.insertNode(br);
      range.insertNode(img);

      // Move cursor after the br
      const newRange = document.createRange();
      newRange.setStartAfter(br);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      
      // Save selection state
      savedRangeRef.current = newRange.cloneRange();
    }

    // Ensure images are draggable
    ensureImagesDraggable();

    // Auto-select the newly inserted image to show resizer immediately!
    setTimeout(() => {
      setSelectedImage(img);
      const rect = img.getBoundingClientRect();
      const container = img.closest('.editor-container');
      if (container) {
        const parentRect = container.getBoundingClientRect();
        setResizerRect({
          top: rect.top - parentRect.top,
          left: rect.left - parentRect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }, 50);
  }

  const handleEditorClick = (e) => {
    if (e.target.tagName === 'IMG') {
      const img = e.target;
      setSelectedImage(img);
      const rect = img.getBoundingClientRect();
      const container = img.closest('.editor-container');
      const parentRect = container.getBoundingClientRect();
      setResizerRect({
        top: rect.top - parentRect.top,
        left: rect.left - parentRect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setSelectedImage(null);
      setResizerRect(null);
    }
  };

  const handleDragStart = (e) => {
    if (e.target.tagName === 'IMG') {
      draggedImageRef.current = e.target;
      // Set empty data to satisfy HTML5 Drag API
      e.dataTransfer.setData('text/html', e.target.outerHTML);
      // Hide resizer overlay during dragging
      setSelectedImage(null);
      setResizerRect(null);
    }
  };

  const handleDragOver = (e) => {
    if (draggedImageRef.current) {
      e.preventDefault();
    }
  };

  const handleDrop = (e) => {
    if (draggedImageRef.current) {
      e.preventDefault();
      const img = draggedImageRef.current;

      let range;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (e.rangeParent) {
        range = document.createRange();
        range.setStart(e.rangeParent, e.rangeOffset);
      }

      if (range) {
        img.remove();
        range.insertNode(img);
        
        // Reselect the image to place the resizer overlay on it
        setSelectedImage(img);

        // Update the resizer box position immediately
        setTimeout(() => {
          const rect = img.getBoundingClientRect();
          const container = img.closest('.editor-container');
          if (container) {
            const parentRect = container.getBoundingClientRect();
            setResizerRect({
              top: rect.top - parentRect.top,
              left: rect.left - parentRect.left,
              width: rect.width,
              height: rect.height,
            });
          }
        }, 50);
      }
      draggedImageRef.current = null;
    }
  };

  const handleResizeStart = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;

    const img = selectedImage;
    const isDraggableInitially = img.getAttribute('draggable') !== 'false';
    img.setAttribute('draggable', 'false'); // Resizing ke dauran dragging disable karein

    const startEvent = e.touches && e.touches.length > 0 ? e.touches[0] : e;
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startRect = img.getBoundingClientRect();
    const startWidth = startRect.width;
    const startHeight = startRect.height;
    const aspectRatio = (startHeight && startHeight > 0) ? startWidth / startHeight : 1;

    const handleMouseMove = (moveEvent) => {
      if (moveEvent.cancelable) {
        moveEvent.preventDefault(); // Prevent page scrolling on mobile
      }
      const currentEvent = moveEvent.touches && moveEvent.touches.length > 0 ? moveEvent.touches[0] : moveEvent;
      if (!currentEvent) return;

      const dx = currentEvent.clientX - startX;
      const dy = currentEvent.clientY - startY;

      let changeX = dx;
      let changeY = dy;

      if (direction.includes('left')) {
        changeX = -dx;
      }
      if (direction.includes('top')) {
        changeY = -dy;
      }

      // Convert changeY to changeX equivalents using aspect ratio
      const changeYAsX = changeY * aspectRatio;

      // Use the larger magnitude change
      let finalChangeX = changeX;
      if (Math.abs(changeYAsX) > Math.abs(changeX)) {
        finalChangeX = changeYAsX;
      }

      let newWidth = startWidth + finalChangeX;

      if (newWidth < 50) newWidth = 50;

      const container = img.closest('.editor-container');
      const maxWidth = container.clientWidth - 80;
      if (newWidth > maxWidth) newWidth = maxWidth;

      img.style.width = `${newWidth}px`;
      img.style.height = 'auto';

      // Keep position updated manually during mouse moves for immediate response
      const rect = img.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      setResizerRect({
        top: rect.top - parentRect.top,
        left: rect.left - parentRect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const handleMouseUp = () => {
      if (isDraggableInitially) {
        img.setAttribute('draggable', 'true'); // Restore dragging after resizing
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
  };

  // Sync resizer position in real-time using MutationObserver and window events
  useEffect(() => {
    if (!selectedImage) {
      setResizerRect(null);
      return;
    }

    const updatePosition = () => {
      if (!selectedImage) return;
      const rect = selectedImage.getBoundingClientRect();
      const container = selectedImage.closest('.editor-container');
      if (container) {
        const parentRect = container.getBoundingClientRect();
        setResizerRect({
          top: rect.top - parentRect.top,
          left: rect.left - parentRect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updatePosition();

    const observer = new MutationObserver(() => {
      if (selectedImage && !document.body.contains(selectedImage)) {
        setSelectedImage(null);
        setResizerRect(null);
        return;
      }
      updatePosition();
    });

    if (editorRef.current) {
      observer.observe(editorRef.current, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [selectedImage]);

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
      const postData = {
        title,
        category,
        content,
        excerpt,
        cover_image_url: coverImage.url,
        cover_image_key: coverImage.key,
        status: 'published',
      };

      if (editId) {
        await updatePost(editId, postData);
        alert(`"${title}" updated and published successfully!`);
      } else {
        await createPost(postData);
        alert(`"${title}" published successfully as ${category}!`);
      }
      localStorage.removeItem(DRAFT_KEY);
      navigate('/');
    } catch (err) {
      if (err.message?.includes('expired')) {
        alert(err.message);
        navigate('/login');
        return;
      }
      alert('Publish failed: ' + (err.response?.data?.error || err.message || 'Unknown error'));
    } finally {
      setPublishing(false);
    }
  }

  function handleStartNew() {
    if (window.confirm('Clear editor and start a new story?')) {
      setTitle('');
      setCategory('story');
      setCoverImage({ url: null, key: null });
      setCoverUploaded(false);
      setInitialContent('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setSearchParams({});
    }
  }

  const handleDeleteDraft = async (e, id, title) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the draft "${title}"?`)) {
      try {
        await deletePost(id);
        showToast('Draft deleted successfully', 'var(--accent-neon)');
        if (editId === String(id)) {
          setTitle('');
          setCategory('story');
          setCoverImage({ url: null, key: null });
          setCoverUploaded(false);
          setInitialContent('');
          if (editorRef.current) editorRef.current.innerHTML = '';
          setSearchParams({});
        }
        fetchServerDrafts();
      } catch (err) {
        alert('Failed to delete draft: ' + (err.response?.data?.error || err.message));
      }
    }
  };

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
        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '2rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '1.2rem',
            flexWrap: 'wrap',
            maxWidth: '1200px',
            margin: '0 auto 2rem auto',
            paddingLeft: '1rem',
            paddingRight: '1rem'
          }}
        >
          <button
            onClick={() => setActiveTab('write')}
            className="neon-btn"
            style={{
              background: activeTab === 'write' ? 'var(--accent-neon)' : 'transparent',
              color: activeTab === 'write' ? 'var(--bg-primary)' : 'inherit',
              borderColor: activeTab === 'write' ? 'var(--accent-neon)' : 'var(--border-color)',
              fontWeight: 'bold',
              padding: '10px 22px',
              fontSize: '0.95rem'
            }}
          >
            📝 Write Story
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className="neon-btn"
            style={{
              background: activeTab === 'drafts' ? 'var(--accent-neon)' : 'transparent',
              color: activeTab === 'drafts' ? 'var(--bg-primary)' : 'inherit',
              borderColor: activeTab === 'drafts' ? 'var(--accent-neon)' : 'var(--border-color)',
              fontWeight: 'bold',
              padding: '10px 22px',
              fontSize: '0.95rem'
            }}
          >
            💾 Server Drafts ({draftsList.length})
          </button>
          <button
            onClick={() => setActiveTab('socials')}
            className="neon-btn"
            style={{
              background: activeTab === 'socials' ? 'var(--accent-neon)' : 'transparent',
              color: activeTab === 'socials' ? 'var(--bg-primary)' : 'inherit',
              borderColor: activeTab === 'socials' ? 'var(--accent-neon)' : 'var(--border-color)',
              fontWeight: 'bold',
              padding: '10px 22px',
              fontSize: '0.95rem'
            }}
          >
            🔗 Social Settings
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className="neon-btn"
            style={{
              background: activeTab === 'users' ? 'var(--accent-neon)' : 'transparent',
              color: activeTab === 'users' ? 'var(--bg-primary)' : 'inherit',
              borderColor: activeTab === 'users' ? 'var(--accent-neon)' : 'var(--border-color)',
              fontWeight: 'bold',
              padding: '10px 22px',
              fontSize: '0.95rem'
            }}
          >
            👥 User Management ({usersList.length})
          </button>
        </div>

        {activeTab === 'write' && (
          <div className="editor-container" style={{ position: 'relative' }}>
          {/* Resizer Dashed Box and Handles */}
          {resizerRect && (
            <div
              style={{
                position: 'absolute',
                top: resizerRect.top,
                left: resizerRect.left,
                width: resizerRect.width,
                height: resizerRect.height,
                border: '2px dashed var(--accent-neon)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {/* Corner Handles */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((dir) => {
                const isTop = dir.startsWith('top');
                const isLeft = dir.endsWith('left');
                return (
                  <div
                    key={dir}
                    style={{
                      position: 'absolute',
                      width: 10,
                      height: 10,
                      background: 'var(--accent-neon)',
                      border: '1px solid #000',
                      borderRadius: '50%',
                      cursor: dir === 'top-left' || dir === 'bottom-right' ? 'nwse-resize' : 'nesw-resize',
                      pointerEvents: 'auto',
                      top: isTop ? -5 : 'auto',
                      bottom: !isTop ? -5 : 'auto',
                      left: isLeft ? -5 : 'auto',
                      right: !isLeft ? -5 : 'auto',
                    }}
                    onMouseDown={(e) => handleResizeStart(e, dir)}
                    onTouchStart={(e) => handleResizeStart(e, dir)}
                    onClick={(e) => e.stopPropagation()}
                  />
                );
              })}
              
              {/* Delete Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ff4a4a',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-main)',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  boxShadow: '0 2px 10px rgba(255,74,74,0.4)',
                  whiteSpace: 'nowrap',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectedImage.remove();
                  setSelectedImage(null);
                  setResizerRect(null);
                }}
              >
                Delete Image
              </div>
            </div>
          )}
          {/* Editor Header */}
          <div className="editor-header">
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
              {editId ? 'Edit Story' : 'Draft New Story'}
            </h2>
            <div style={{ display: 'flex', gap: 12 }}>
              {editId && (
                <button
                  className="neon-btn"
                  style={{ borderColor: 'var(--border-color)', background: 'transparent' }}
                  onClick={handleStartNew}
                >
                  Start New
                </button>
              )}
              <button
                className="neon-btn"
                style={{ background: 'transparent' }}
                onClick={handleSaveDraftServer}
              >
                {editId ? 'Save Draft' : 'Save Server Draft'}
              </button>
              <button
                className="neon-btn"
                style={{ background: 'var(--accent-neon)', color: 'var(--bg-primary)' }}
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? 'Publishing...' : editId ? 'Publish Changes' : 'Publish'}
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
              <option value="wgws">Publish as WGWS</option>
            </select>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <button onClick={() => format('bold')} title="Bold"><b>B</b></button>
            <button onClick={() => format('italic')} title="Italic"><i>I</i></button>
            <button onClick={() => format('underline')} title="Underline"><u>U</u></button>
            <span>|</span>
            <button onClick={() => format('justifyLeft')} title="Left Align">Left</button>
            <button onClick={() => format('justifyCenter')} title="Center Align">Center</button>
            <span>|</span>
            <select onChange={(e) => format('formatBlock', e.target.value)} defaultValue="P" title="Formatting Block">
              <option value="P">Paragraph</option>
              <option value="H1">Heading 1</option>
              <option value="H2">Heading 2</option>
              <option value="H3">Heading 3</option>
              <option value="H4">Heading 4</option>
              <option value="blockquote">Quote Block</option>
            </select>
            <select
              title="Font Size"
              onChange={(e) => {
                if (e.target.value) {
                  format('fontSize', e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="">Font Size</option>
              <option value="2">Small</option>
              <option value="3">Normal</option>
              <option value="4">Medium</option>
              <option value="5">Large</option>
              <option value="6">Extra Large</option>
            </select>
            <select
              title="Text Color"
              onChange={(e) => {
                if (e.target.value) {
                  format('foreColor', e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="">Text Color</option>
              <option value="#ffffff" style={{ color: '#ffffff', background: '#000' }}>White</option>
              <option value="#eaff00" style={{ color: '#eaff00', background: '#000' }}>Neon Yellow</option>
              <option value="#2ecc71" style={{ color: '#2ecc71', background: '#000' }}>Neon Green</option>
              <option value="#3498db" style={{ color: '#3498db', background: '#000' }}>Neon Blue</option>
              <option value="#ff4a4a" style={{ color: '#ff4a4a', background: '#000' }}>Neon Red</option>
            </select>
            <span>|</span>
            <button onClick={() => format('insertUnorderedList')} title="Bullet List">• List</button>
            <button onClick={() => format('insertOrderedList')} title="Numbered List">1. List</button>
            <button onClick={() => format('insertHorizontalRule')} title="Horizontal Line">― Divider</button>
            <span>|</span>
            <button onClick={() => format('undo')} title="Undo">Undo</button>
            <button onClick={() => format('redo')} title="Redo">Redo</button>
            <span>|</span>
            <button
              style={{ color: 'var(--accent-neon)', fontWeight: 'bold' }}
              onClick={() => inlineInputRef.current.click()}
            >
              + Upload Image
            </button>
            <button
              style={{ color: 'var(--accent-neon)', fontWeight: 'bold' }}
              onClick={handleInsertImageUrl}
            >
              + Insert URL
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
            dangerouslySetInnerHTML={{ __html: initialContent }}
            onClick={handleEditorClick}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onInput={ensureImagesDraggable}
          />
        </div>
        )}

        {/* Admin Socials Settings Section */}
        {activeTab === 'socials' && (
          <div className="editor-container" style={{ marginTop: '0rem' }}>
          <h3
            className="neon-text"
            style={{
              fontSize: '1.4rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>🔗 Admin Social Links Settings</span>
          </h3>
          <div className="glass-panel" style={{ padding: '25px', borderRadius: 8, border: '1px solid rgba(234, 255, 0, 0.15)' }}>
            <form onSubmit={handleSaveSocials} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Instagram Profile Link</label>
                <input
                  type="url"
                  placeholder="https://instagram.com/username"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  style={{
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-main)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Facebook Profile Link</label>
                <input
                  type="url"
                  placeholder="https://facebook.com/username"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  style={{
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-main)'
                  }}
                />
              </div>

              <button
                type="submit"
                className="neon-btn"
                style={{ alignSelf: 'flex-start', padding: '10px 20px', marginTop: '10px' }}
                disabled={savingSettings}
              >
                {savingSettings ? 'Saving Settings...' : 'Save Social Links'}
              </button>
            </form>
          </div>
        </div>
        )}

        {/* Drafts List Section */}
        {activeTab === 'drafts' && (
          <div className="editor-container" style={{ marginTop: '0rem' }}>
            <h3
              className="neon-text"
              style={{
                fontSize: '1.4rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span>📝 Saved Drafts on Server</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                ({draftsList.length})
              </span>
            </h3>
            {draftsList.length === 0 ? (
              <div className="glass-panel" style={{ padding: '25px', borderRadius: 8, border: '1px solid rgba(234, 255, 0, 0.15)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No drafts found on the server.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 20,
                }}
              >
              {draftsList.map((draft) => (
                <div
                  key={draft.id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    borderRadius: 8,
                    border: '1px solid rgba(234, 255, 0, 0.15)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => setSearchParams({ edit: String(draft.id) })}
                >
                  <div>
                    <span
                      className="story-tag"
                      style={{ fontSize: '0.75rem', marginBottom: 8, display: 'inline-block' }}
                    >
                      {draft.category === 'wgws' ? 'WGWS' : draft.category.charAt(0).toUpperCase() + draft.category.slice(1)}
                    </span>
                    <h4
                      style={{
                        margin: '0 0 10px 0',
                        fontSize: '1.1rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {draft.title || 'Untitled Draft'}
                    </h4>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {draft.excerpt || 'No description...'}
                    </p>
                  </div>
                  <div
                    style={{
                      marginTop: 15,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>{new Date(draft.created_at).toLocaleDateString()}</span>
                    <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                      <span 
                        onClick={(e) => handleDeleteDraft(e, draft.id, draft.title)}
                        style={{ color: '#ff4a4a', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Delete
                      </span>
                      <span className="neon-text-accent" style={{ fontSize: '0.85rem' }}>
                        Edit →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
        {/* Registered Users Management Section */}
        {activeTab === 'users' && (
          <div className="editor-container" style={{ marginTop: '0rem' }}>
          <h3
            className="neon-text"
            style={{
              fontSize: '1.4rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>👥 Registered Users Management</span>
            {loadingUsers && <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading...</span>}
          </h3>
          <div className="glass-panel" style={{ padding: '25px', borderRadius: 8, border: '1px solid rgba(234, 255, 0, 0.15)', overflowX: 'auto' }}>
            {usersList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No other registered users found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>ID</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Name</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Email</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Role</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Joined Date</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((usr) => (
                    <tr key={usr.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{usr.id}</td>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{usr.name || 'N/A'}</td>
                      <td style={{ padding: '10px' }}>{usr.email}</td>
                      <td style={{ padding: '10px' }}>
                        <span className="story-tag" style={{ fontSize: '0.75rem', padding: '3px 8px', background: usr.role === 'admin' ? 'var(--accent-neon)' : '#555', color: usr.role === 'admin' ? 'var(--bg-primary)' : 'inherit' }}>
                          {usr.role}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          color: usr.status === 'blocked' ? '#ff4a4a' : '#2ecc71',
                          textShadow: usr.status === 'blocked' ? '0 0 10px rgba(255,74,74,0.4)' : 'none',
                          fontWeight: 'bold'
                        }}>
                          {(usr.status || 'active').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {new Date(usr.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {usr.id === getCurrentUser()?.id ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Logged In</span>
                        ) : (
                          <button
                            onClick={() => handleToggleBlock(usr.id, usr.email)}
                            className="neon-btn"
                            style={{
                              borderColor: usr.status === 'blocked' ? '#2ecc71' : '#ff4a4a',
                              color: usr.status === 'blocked' ? '#2ecc71' : '#ff4a4a',
                              padding: '5px 12px',
                              fontSize: '0.8rem',
                              background: 'transparent'
                            }}
                          >
                            {usr.status === 'blocked' ? 'Unblock' : 'Block User'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        )}
      </main>
    </>
  );
}
