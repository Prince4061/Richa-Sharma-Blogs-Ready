"""
Flask Backend Server for ऋचाएं (Richa Sharma Stories & Blogs)
Proxies requests to Insforge Database REST API
"""

import os
import requests as http_requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ─── Insforge Configuration ───
INSFORGE_BASE = 'https://iznwab88.us-east.insforge.app/api'
ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTEzODV9.Xv-dQLWzgoirFBpDAyyLzFq4Gn1rohv2oOnFOionhLE'


def get_auth_header():
    """Extract Bearer token from incoming request, fallback to anon key."""
    auth = request.headers.get('Authorization', '')
    if auth:
        return auth
    return f'Bearer {ANON_KEY}'


def proxy_headers(content_type='application/json', prefer=None):
    """Build headers for Insforge API calls."""
    headers = {
        'Authorization': get_auth_header(),
    }
    if content_type:
        headers['Content-Type'] = content_type
    if prefer:
        headers['Prefer'] = prefer
    return headers


# ════════════════════════════════════════════
#  POSTS (maps to Insforge "stories" table)
# ════════════════════════════════════════════

@app.route('/api/posts', methods=['GET'])
def get_posts():
    """Fetch posts, optionally filtered by category."""
    category = request.args.get('category', 'story')
    url = (
        f'{INSFORGE_BASE}/database/records/stories'
        f'?category=eq.{category}'
        f'&select=*,profiles(name,avatar_url)'
        f'&order=created_at.desc'
    )
    resp = http_requests.get(url, headers=proxy_headers())
    return jsonify(resp.json()), resp.status_code


@app.route('/api/posts/<post_id>', methods=['GET'])
def get_post(post_id):
    """Fetch a single post by ID."""
    url = (
        f'{INSFORGE_BASE}/database/records/stories'
        f'?id=eq.{post_id}'
        f'&select=*,profiles(name,avatar_url)'
    )
    resp = http_requests.get(url, headers=proxy_headers())
    data = resp.json()
    if isinstance(data, list) and len(data) > 0:
        return jsonify(data[0]), 200
    return jsonify({'error': 'Post not found'}), 404


@app.route('/api/posts', methods=['POST'])
def create_post():
    """Create a new post (story/article/series/comics/drama)."""
    body = request.get_json()
    if not body:
        return jsonify({'error': 'Request body is required'}), 400

    url = f'{INSFORGE_BASE}/database/records/stories'
    headers = proxy_headers(prefer='return=representation')
    # Insforge expects an array
    payload = [body] if isinstance(body, dict) else body

    resp = http_requests.post(url, json=payload, headers=headers)

    if resp.status_code in (200, 201):
        return jsonify(resp.json()), 201
    return jsonify(resp.json()), resp.status_code


@app.route('/api/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    """Delete a post by ID."""
    url = f'{INSFORGE_BASE}/database/records/stories?id=eq.{post_id}'
    resp = http_requests.delete(url, headers=proxy_headers())
    if resp.status_code == 204:
        return '', 204
    try:
        return jsonify(resp.json()), resp.status_code
    except Exception:
        return '', resp.status_code


# ════════════════════════════════════════════
#  COMMENTS
# ════════════════════════════════════════════

@app.route('/api/comments/<story_id>', methods=['GET'])
def get_comments(story_id):
    """Fetch comments for a specific story."""
    url = (
        f'{INSFORGE_BASE}/database/records/comments'
        f'?story_id=eq.{story_id}'
        f'&select=*,profiles(name,avatar_url)'
        f'&order=created_at.desc'
    )
    resp = http_requests.get(url, headers=proxy_headers())
    return jsonify(resp.json()), resp.status_code


@app.route('/api/comments', methods=['POST'])
def add_comment():
    """Add a comment to a story."""
    body = request.get_json()
    if not body:
        return jsonify({'error': 'Request body is required'}), 400

    url = f'{INSFORGE_BASE}/database/records/comments'
    headers = proxy_headers(prefer='return=representation')
    payload = [body] if isinstance(body, dict) else body

    resp = http_requests.post(url, json=payload, headers=headers)

    if resp.status_code in (200, 201):
        return jsonify(resp.json()), 201
    return jsonify(resp.json()), resp.status_code


# ════════════════════════════════════════════
#  AUTHENTICATION (proxy to Insforge Auth)
# ════════════════════════════════════════════

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Login with email and password."""
    body = request.get_json()
    url = f'{INSFORGE_BASE}/auth/sessions?client_type=mobile'
    resp = http_requests.post(
        url,
        json=body,
        headers={'Content-Type': 'application/json'}
    )
    return jsonify(resp.json()), resp.status_code


@app.route('/api/auth/signup', methods=['POST'])
def auth_signup():
    """Sign up a new user and auto-create profile."""
    body = request.get_json()
    url = f'{INSFORGE_BASE}/auth/users?client_type=mobile'
    resp = http_requests.post(
        url,
        json=body,
        headers={'Content-Type': 'application/json'}
    )
    data = resp.json()

    # Auto-create profile after successful signup
    if resp.status_code in (200, 201) and data.get('user') and data.get('accessToken'):
        try:
            profile_url = f'{INSFORGE_BASE}/database/records/profiles'
            profile_headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {data["accessToken"]}',
                'Prefer': 'return=representation,resolution=ignore-duplicates'
            }
            profile_data = [{
                'id': data['user']['id'],
                'email': data['user']['email'],
                'name': body.get('name', '')
            }]
            http_requests.post(profile_url, json=profile_data, headers=profile_headers)
        except Exception:
            pass  # Non-fatal — user can still login

    return jsonify(data), resp.status_code


# ════════════════════════════════════════════
#  IMAGE UPLOAD (proxy to Insforge Storage)
# ════════════════════════════════════════════

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """Upload an image to Insforge storage bucket."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    url = f'{INSFORGE_BASE}/storage/buckets/images/objects/auto'

    files = {'file': (file.filename, file.stream, file.content_type)}
    headers = {'Authorization': get_auth_header()}

    resp = http_requests.post(url, files=files, headers=headers)

    if resp.status_code in (200, 201):
        data = resp.json()
        # Handle different response shapes
        if isinstance(data, dict) and data.get('url'):
            return jsonify({'url': data['url'], 'key': data.get('key')}), 200
        if isinstance(data, dict) and data.get('data', {}).get('url'):
            return jsonify({'url': data['data']['url'], 'key': data['data'].get('key')}), 200
        if isinstance(data, list) and len(data) > 0 and data[0].get('url'):
            return jsonify({'url': data[0]['url'], 'key': data[0].get('key')}), 200
        return jsonify(data), 200

    return jsonify(resp.json()), resp.status_code


# ════════════════════════════════════════════
#  SERVE REACT BUILD (Production)
# ════════════════════════════════════════════

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve React build files in production."""
    static_folder = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
    if path and os.path.exists(os.path.join(static_folder, path)):
        from flask import send_from_directory
        return send_from_directory(static_folder, path)
    index_path = os.path.join(static_folder, 'index.html')
    if os.path.exists(index_path):
        from flask import send_from_directory
        return send_from_directory(static_folder, 'index.html')
    return jsonify({'message': 'Richa Sharma Stories API is running. Build the React frontend for the UI.'}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
