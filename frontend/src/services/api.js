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

// ═══════ POSTS ═══════

export async function getPosts(category = 'story') {
  const res = await api.get(`/posts?category=${category}`);
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

export async function deletePost(id) {
  const res = await api.delete(`/posts/${id}`);
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

// ═══════ IMAGE UPLOAD (Direct to Insforge Storage) ═══════

const INSFORGE_BASE = 'https://iznwab88.us-east.insforge.app/api';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Mjc2NTB9.U75HsMPjtg8jK9kRsReJ6tnqWCM--GaGoPhSvMX4q-s';

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAuthToken() || ANON_KEY;
  const res = await fetch(`${INSFORGE_BASE}/storage/buckets/images/objects/auto`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  // Handle Insforge response shape: { data: { url, key } } or { url, key }
  const result = data.data || data;
  if (!result.url) throw new Error('Upload succeeded but no URL returned');
  return { url: result.url, key: result.key };
}

export default api;
