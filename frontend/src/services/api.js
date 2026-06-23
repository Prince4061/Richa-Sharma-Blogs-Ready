// ─── API Service ───
// Axios-based API calls to Flask backend

import axios from 'axios';
import { getAuthToken, saveSession, getCurrentUser } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth token expiration / invalid responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh');
      localStorage.removeItem('auth_user');
      error.message = 'Your session has expired. Please login again.';
    }
    return Promise.reject(error);
  }
);

// ═══════ POSTS ═══════

export async function getPosts(category = 'story', status = 'published') {
  const res = await api.get(`/posts?category=${category}&status=${status}`);
  return res.data;
}

export async function getPost(id) {
  const res = await api.get(`/posts/${id}`);
  return res.data;
}

export async function createPost(postData) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not logged in. Please login first.');
  postData.author_id = user.id;
  const res = await api.post('/posts', postData);
  return res.data;
}

export async function updatePost(id, postData) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not logged in. Please login first.');
  const res = await api.put(`/posts/${id}`, postData);
  return res.data;
}

export async function deletePost(id) {
  const res = await api.delete(`/posts/${id}`);
  return res.data;
}

// ═══════ BOOKMARKS ═══════

export async function toggleBookmark(storyId) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not logged in. Please login first.');
  const res = await api.post('/bookmarks', { story_id: storyId });
  return res.data; // { bookmarked: boolean }
}

export async function getBookmarks() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not logged in. Please login first.');
  const res = await api.get('/bookmarks');
  return res.data;
}

// ═══════ COMMENTS ═══════

export async function getComments(storyId) {
  const res = await api.get(`/comments/${storyId}`);
  return res.data;
}

export async function addComment(storyId, content) {
  const user = getCurrentUser();
  if (!user) throw new Error('Please login to comment.');
  const res = await api.post('/comments', {
    story_id: storyId,
    user_id: user.id,
    content: content,
  });
  return res.data;
}

// ═══════ AUTH ═══════

export async function login(phoneOrEmail, password) {
  const res = await api.post('/auth/login', { phone: phoneOrEmail, password });
  const data = res.data;
  saveSession(data);
  return data;
}

export async function signup(phoneOrEmail, password, name) {
  const res = await api.post('/auth/signup', { phone: phoneOrEmail, password, name });
  const data = res.data;
  saveSession(data);
  return data;
}

// ═══════ IMAGE UPLOAD (Local SQLite Backend API) ═══════

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data; // returns { url, key }
}

// ═══════ ADMIN PROFILE ═══════

export async function getAdminProfile() {
  const res = await api.get('/admin/profile');
  return res.data;
}

export async function updateAdminProfile(profileData) {
  const res = await api.put('/admin/profile', profileData);
  return res.data;
}

// ═══════ USER MANAGEMENT ═══════

export async function getUsers() {
  const res = await api.get('/admin/users');
  return res.data;
}

export async function toggleBlockUser(userId) {
  const res = await api.post(`/admin/users/${userId}/toggle-block`);
  return res.data;
}

export default api;

