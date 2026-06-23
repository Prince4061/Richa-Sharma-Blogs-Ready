// ─── Vanilla DB Service for SQLite Backend ───
const API_BASE = '/api';

/**
 * Core API fetch helper.
 * Automatically attaches Bearer token if logged in.
 */
async function apiFetch(endpoint, method = 'GET', body = null, isFormData = false) {
    const token = localStorage.getItem('auth_token');
    const headers = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (!isFormData && body) {
        headers['Content-Type'] = 'application/json';
    }

    const options = { method, headers };
    if (body) {
        options.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, options);

    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const errorMessage = data?.message || data?.error || `API Error: ${res.status}`;
        
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('expired')) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_refresh');
            localStorage.removeItem('auth_user');
            throw new Error('Your session has expired. Please log in again.');
        }

        throw new Error(errorMessage);
    }

    return data;
}

/** ============ DATABASE API ============ **/

// Get all content by category (story, article, series, comics, drama)
async function getStories(category = 'story') {
    return await apiFetch(`/posts?category=${category}`);
}

// Get a single story/article by ID
async function getStory(id) {
    return await apiFetch(`/posts/${id}`);
}

// Get comments for a story (newest first)
async function getComments(storyId) {
    return await apiFetch(`/comments/${storyId}`);
}

// Create a new story/article (admin only)
async function createStory(storyData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not logged in. Please login first.');

    storyData.author_id = user.id;
    return await apiFetch('/posts', 'POST', storyData);
}

// Delete a story
async function deleteStory(id) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not logged in.');
    return await apiFetch(`/posts/${id}`, 'DELETE');
}

// Add a comment
async function addComment(storyId, content) {
    const user = getCurrentUser();
    if (!user) throw new Error('Please login to comment.');

    const commentData = {
        story_id: storyId,
        user_id: user.id,
        content: content
    };
    return await apiFetch('/comments', 'POST', commentData);
}

/** ============ STORAGE API ============ **/

// Upload an image to Flask backend static uploads
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const data = await apiFetch('/upload', 'POST', formData, true);
    if (data && data.url) {
        return { url: data.url, key: data.key };
    }
    throw new Error('Image upload failed.');
}

// Get admin profile details
async function getAdminProfile() {
    return await apiFetch('/admin/profile');
}

// Update admin profile details
async function updateAdminProfile(profileData) {
    return await apiFetch('/admin/profile', 'PUT', profileData);
}

// Fetch all registered users (admin only)
async function getUsers() {
    return await apiFetch('/admin/users');
}

// Block/unblock a user (admin only)
async function toggleBlockUser(userId) {
    return await apiFetch(`/admin/users/${userId}/toggle-block`, 'POST');
}

// Session Helpers
function getCurrentUser() {
    const userStr = localStorage.getItem('auth_user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}
