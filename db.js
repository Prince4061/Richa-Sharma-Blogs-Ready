const INSFORGE_API_BASE = 'https://iznwab88.us-east.insforge.app/api';

// Anon key for public read access (generated, never expires)
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTEzODV9.Xv-dQLWzgoirFBpDAyyLzFq4Gn1rohv2oOnFOionhLE';

/**
 * Core API fetch helper.
 * Automatically attaches Bearer token (user session or anon key).
 * For FormData uploads, does NOT set Content-Type (browser sets it with boundary).
 */
async function apiFetch(endpoint, method = 'GET', body = null, isFormData = false) {
    const token = localStorage.getItem('auth_token');
    const headers = {};

    // Use user token if logged in, otherwise fall back to anon key
    headers['Authorization'] = `Bearer ${token || ANON_KEY}`;

    if (!isFormData && body) {
        headers['Content-Type'] = 'application/json';
        // Only add Prefer header for DB POST/PATCH (not storage)
        if ((method === 'POST' || method === 'PATCH') && endpoint.startsWith('/database')) {
            headers['Prefer'] = 'return=representation';
        }
    }

    const options = { method, headers };
    if (body) {
        options.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${INSFORGE_API_BASE}${endpoint}`, options);

    // 204 = success with no content (DELETE)
    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const errorMessage = data?.message || data?.error || `API Error: ${res.status}`;

        // Handle expired JWT session — log user out
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('jwt expired')) {
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
    return await apiFetch(
        `/database/records/stories?category=eq.${category}&select=*,profiles(name,avatar_url)&order=created_at.desc`
    );
}

// Get a single story/article by ID
async function getStory(id) {
    const data = await apiFetch(
        `/database/records/stories?id=eq.${id}&select=*,profiles(name,avatar_url)`
    );
    return data && data.length > 0 ? data[0] : null;
}

// Get comments for a story (newest first)
async function getComments(storyId) {
    return await apiFetch(
        `/database/records/comments?story_id=eq.${storyId}&select=*,profiles(name,avatar_url)&order=created_at.desc`
    );
}

// Create a new story/article (admin only — RLS enforces authentication)
async function createStory(storyData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not logged in. Please login first.');

    storyData.author_id = user.id;
    return await apiFetch('/database/records/stories', 'POST', [storyData]);
}

// Delete a story (RLS enforces owner-only delete)
async function deleteStory(id) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not logged in.');
    return await apiFetch(`/database/records/stories?id=eq.${id}`, 'DELETE');
}

// Add a comment (RLS enforces logged-in user)
async function addComment(storyId, content) {
    const user = getCurrentUser();
    if (!user) throw new Error('Please login to comment.');

    const commentData = {
        story_id: storyId,
        user_id: user.id,
        content: content
    };
    return await apiFetch('/database/records/comments', 'POST', [commentData]);
}

/** ============ STORAGE API ============ **/

// Upload an image to InsForge storage (auto-generates unique filename)
async function uploadImage(file) {
    // /auto endpoint generates a unique key automatically (uploadAuto)
    const endpoint = `/storage/buckets/images/objects/auto`;

    const formData = new FormData();
    formData.append('file', file);

    const data = await apiFetch(endpoint, 'POST', formData, true);

    // Handle various response shapes from the API
    if (data && data.url) {
        return { url: data.url, key: data.key };
    }
    if (data && data.data && data.data.url) {
        return { url: data.data.url, key: data.data.key };
    }
    if (Array.isArray(data) && data[0] && data[0].url) {
        return { url: data[0].url, key: data[0].key };
    }

    console.error('Unexpected upload response:', JSON.stringify(data));
    throw new Error('Image upload failed — server returned unexpected response. Check console for details.');
}
