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

// ═══════ IMAGE UPLOAD (Direct to Insforge Storage - upload-strategy flow) ═══════

const INSFORGE_BASE = 'https://iznwab88.us-east.insforge.app/api';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Mjc2NTB9.U75HsMPjtg8jK9kRsReJ6tnqWCM--GaGoPhSvMX4q-s';

export async function uploadImage(file) {
  const token = getAuthToken() || ANON_KEY;
  const authHeader = { Authorization: `Bearer ${token}` };

  // Step 1: Get upload strategy
  const strategyRes = await fetch(`${INSFORGE_BASE}/storage/buckets/images/upload-strategy`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  if (!strategyRes.ok) {
    const err = await strategyRes.json().catch(() => ({}));
    throw new Error(err.message || `Strategy fetch failed: ${strategyRes.status}`);
  }
  const strategy = await strategyRes.json();

  // Step 2: Upload the file
  if (strategy.method === 'presigned') {
    // S3 presigned upload
    const s3Form = new FormData();
    Object.entries(strategy.fields || {}).forEach(([k, v]) => s3Form.append(k, v));
    s3Form.append('file', file);
    const s3Res = await fetch(strategy.uploadUrl, { method: 'POST', body: s3Form });
    if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status}`);

    // Step 3: Confirm upload
    if (strategy.confirmRequired) {
      const INSFORGE_HOST = 'https://iznwab88.us-east.insforge.app';
      const confirmRes = await fetch(`${INSFORGE_HOST}${strategy.confirmUrl}`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: file.size, contentType: file.type }),
      });
      if (!confirmRes.ok) throw new Error('Upload confirmation failed');
      const confirmed = await confirmRes.json();
      const url = confirmed.url?.startsWith('http')
        ? confirmed.url
        : `${INSFORGE_BASE}${confirmed.url}`;
      return { url, key: confirmed.key };
    }
  } else {
    // Local storage direct upload
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch(
      strategy.uploadUrl?.startsWith('http')
        ? strategy.uploadUrl
        : `${INSFORGE_BASE.replace('/api', '')}${strategy.uploadUrl}`,
      { method: 'PUT', headers: authHeader, body: formData }
    );
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    const result = await uploadRes.json();
    const url = result.url?.startsWith('http')
      ? result.url
      : `https://iznwab88.us-east.insforge.app${result.url}`;
    return { url, key: result.key };
  }

  throw new Error('Upload failed: unknown storage method');
}

export default api;

