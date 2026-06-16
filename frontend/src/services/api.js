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

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  const data = res.data;
  if (data.requireEmailVerification) {
    throw new Error('Email verification required.');
  }
  saveSession(data);
  return data;
}

export async function signup(email, password, name) {
  const res = await api.post('/auth/signup', { email, password, name });
  const data = res.data;
  if (data.requireEmailVerification) {
    throw new Error('Signup successful, but email verification is required.');
  }
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

export default api;

