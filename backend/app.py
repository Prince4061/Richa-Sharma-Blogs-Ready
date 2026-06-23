"""
Flask Backend Server for ऋचाएं (Richa Sharma Stories & Blogs)
Uses a local SQLite database for stories, comments, and users.
"""

import os
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature

app = Flask(__name__)
CORS(app)

# ─── Configuration ───
DATABASE = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), 'database.db'))
os.makedirs(os.path.dirname(DATABASE), exist_ok=True)

UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(__file__), 'uploads'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


SECRET_KEY = os.environ.get('SECRET_KEY', 'richa_sharma_super_secret_key_98765')
app.config['SECRET_KEY'] = SECRET_KEY
serializer = URLSafeTimedSerializer(SECRET_KEY)

# ─── Database Utilities ───
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.execute("PRAGMA foreign_keys = ON")
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with sqlite3.connect(DATABASE) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create stories table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                excerpt TEXT,
                category TEXT NOT NULL,
                cover_image_url TEXT,
                cover_image_key TEXT,
                author_id INTEGER,
                status TEXT DEFAULT 'published',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users (id)
            )
        ''')

        # Run migration if status column does not exist
        try:
            cursor.execute("ALTER TABLE stories ADD COLUMN status TEXT DEFAULT 'published'")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        
        # Run migration if facebook_url or instagram_url columns do not exist in users
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN facebook_url TEXT DEFAULT ''")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE users ADD COLUMN instagram_url TEXT DEFAULT ''")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        
        # Create comments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                story_id INTEGER NOT NULL,
                user_id INTEGER,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Create bookmarks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                story_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE CASCADE,
                UNIQUE(user_id, story_id)
            )
        ''')
        conn.commit()

        # Seed default admin user if not exists
        cursor.execute('SELECT * FROM users WHERE email = ?', ('admin@richasharma.com',))
        if not cursor.fetchone():
            hashed_pw = generate_password_hash('admin123')
            cursor.execute('''
                INSERT INTO users (email, password_hash, name, role)
                VALUES (?, ?, ?, ?)
            ''', ('admin@richasharma.com', hashed_pw, 'Richa Sharma', 'admin'))
            conn.commit()

# Initialize Database
init_db()

# ─── Auth Token Helpers ───
def generate_token(user_id, email, role):
    payload = {
        'id': user_id,
        'email': email,
        'role': role
    }
    return serializer.dumps(payload, salt='auth-salt')

def verify_token(token):
    try:
        # Max age: 1 day = 86400 seconds
        data = serializer.loads(token, salt='auth-salt', max_age=86400)
        return data
    except (SignatureExpired, BadSignature):
        return None

def get_current_user_from_request():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        return verify_token(token)
    return None

# ════════════════════════════════════════════
#  POSTS (Stories)
# ════════════════════════════════════════════

@app.route('/api/posts', methods=['GET'])
def get_posts():
    """Fetch stories, optionally filtered by category and status."""
    category = request.args.get('category', 'story')
    status = request.args.get('status', 'published')

    user = get_current_user_from_request()
    if not user or user.get('role') != 'admin':
        status = 'published'

    db = get_db()
    cursor = db.cursor()

    query = '''
        SELECT s.*, u.name as author_name 
        FROM stories s 
        LEFT JOIN users u ON s.author_id = u.id 
    '''
    params = []
    conditions = []

    if category != 'all':
        conditions.append("s.category = ?")
        params.append(category)

    if status != 'all':
        conditions.append("s.status = ?")
        params.append(status)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY s.created_at DESC"

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    
    posts = []
    for r in rows:
        posts.append({
            'id': r['id'],
            'title': r['title'],
            'content': r['content'],
            'excerpt': r['excerpt'],
            'category': r['category'],
            'cover_image_url': r['cover_image_url'],
            'cover_image_key': r['cover_image_key'],
            'status': r['status'],
            'author_id': r['author_id'],
            'created_at': r['created_at'],
            'profiles': {
                'name': r['author_name'] or 'Richa Sharma',
                'avatar_url': None
            }
        })
    return jsonify(posts), 200


@app.route('/api/posts/<post_id>', methods=['GET'])
def get_post(post_id):
    """Fetch a single post by ID."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT s.*, u.name as author_name 
        FROM stories s 
        LEFT JOIN users u ON s.author_id = u.id 
        WHERE s.id = ?
    ''', (post_id,))
    r = cursor.fetchone()
    if r:
        # If post is draft, check admin permissions
        if r['status'] == 'draft':
            user = get_current_user_from_request()
            if not user or user.get('role') != 'admin':
                return jsonify({'error': 'Unauthorized. This post is a draft.'}), 403

        # Check bookmark state
        is_bookmarked = False
        current_user = get_current_user_from_request()
        if current_user:
            cursor.execute('SELECT 1 FROM bookmarks WHERE user_id = ? AND story_id = ?', (current_user['id'], post_id))
            if cursor.fetchone():
                is_bookmarked = True

        post = {
            'id': r['id'],
            'title': r['title'],
            'content': r['content'],
            'excerpt': r['excerpt'],
            'category': r['category'],
            'cover_image_url': r['cover_image_url'],
            'cover_image_key': r['cover_image_key'],
            'status': r['status'],
            'author_id': r['author_id'],
            'created_at': r['created_at'],
            'is_bookmarked': is_bookmarked,
            'profiles': {
                'name': r['author_name'] or 'Richa Sharma',
                'avatar_url': None
            }
        }
        return jsonify(post), 200
    return jsonify({'error': 'Post not found'}), 404


@app.route('/api/posts', methods=['POST'])
def create_post():
    """Create a new story/post."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Not logged in or session expired.'}), 401
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized. Admin privileges required.'}), 403
        
    body = request.get_json()
    if not body:
        return jsonify({'error': 'Request body is required'}), 400

    if isinstance(body, list):
        body = body[0]

    title = body.get('title')
    content = body.get('content')
    excerpt = body.get('excerpt')
    category = body.get('category', 'story')
    cover_image_url = body.get('cover_image_url')
    cover_image_key = body.get('cover_image_key')
    status = body.get('status', 'published')
    author_id = user['id']

    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400

    if status not in ['published', 'draft']:
        status = 'published'

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO stories (title, content, excerpt, category, cover_image_url, cover_image_key, author_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (title, content, excerpt, category, cover_image_url, cover_image_key, author_id, status))
    db.commit()
    post_id = cursor.lastrowid

    cursor.execute('''
        SELECT s.*, u.name as author_name 
        FROM stories s 
        LEFT JOIN users u ON s.author_id = u.id 
        WHERE s.id = ?
    ''', (post_id,))
    r = cursor.fetchone()
    
    post = {
        'id': r['id'],
        'title': r['title'],
        'content': r['content'],
        'excerpt': r['excerpt'],
        'category': r['category'],
        'cover_image_url': r['cover_image_url'],
        'cover_image_key': r['cover_image_key'],
        'status': r['status'],
        'author_id': r['author_id'],
        'created_at': r['created_at'],
        'profiles': {
            'name': r['author_name'] or 'Richa Sharma',
            'avatar_url': None
        }
    }
    return jsonify(post), 201


@app.route('/api/posts/<post_id>', methods=['PUT'])
def update_post(post_id):
    """Update an existing story/post (Admin only)."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Not logged in or session expired.'}), 401
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized. Admin privileges required.'}), 403
        
    body = request.get_json()
    if not body:
        return jsonify({'error': 'Request body is required'}), 400
        
    if isinstance(body, list):
        body = body[0]
        
    title = body.get('title')
    content = body.get('content')
    excerpt = body.get('excerpt')
    category = body.get('category')
    cover_image_url = body.get('cover_image_url')
    cover_image_key = body.get('cover_image_key')
    status = body.get('status', 'published')
    
    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400
        
    if status not in ['published', 'draft']:
        status = 'published'
        
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('SELECT author_id FROM stories WHERE id = ?', (post_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({'error': 'Post not found'}), 404
        
    cursor.execute('''
        UPDATE stories 
        SET title = ?, content = ?, excerpt = ?, category = ?, cover_image_url = ?, cover_image_key = ?, status = ?
        WHERE id = ?
    ''', (title, content, excerpt, category, cover_image_url, cover_image_key, status, post_id))
    db.commit()
    
    cursor.execute('''
        SELECT s.*, u.name as author_name 
        FROM stories s 
        LEFT JOIN users u ON s.author_id = u.id 
        WHERE s.id = ?
    ''', (post_id,))
    r = cursor.fetchone()
    
    post = {
        'id': r['id'],
        'title': r['title'],
        'content': r['content'],
        'excerpt': r['excerpt'],
        'category': r['category'],
        'cover_image_url': r['cover_image_url'],
        'cover_image_key': r['cover_image_key'],
        'status': r['status'],
        'author_id': r['author_id'],
        'created_at': r['created_at'],
        'profiles': {
            'name': r['author_name'] or 'Richa Sharma',
            'avatar_url': None
        }
    }
    return jsonify(post), 200


# ════════════════════════════════════════════
#  BOOKMARKS
# ════════════════════════════════════════════

@app.route('/api/bookmarks', methods=['POST'])
def toggle_bookmark():
    """Bookmark or unbookmark a story (Registered users)."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Please login to bookmark.'}), 401
        
    body = request.get_json()
    if not body or 'story_id' not in body:
        return jsonify({'error': 'story_id is required'}), 400
        
    story_id = body.get('story_id')
    user_id = user['id']
    
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('SELECT id FROM stories WHERE id = ?', (story_id,))
    if not cursor.fetchone():
        return jsonify({'error': 'Story not found'}), 404
        
    cursor.execute('SELECT id FROM bookmarks WHERE user_id = ? AND story_id = ?', (user_id, story_id))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('DELETE FROM bookmarks WHERE user_id = ? AND story_id = ?', (user_id, story_id))
        db.commit()
        return jsonify({'bookmarked': False}), 200
    else:
        cursor.execute('INSERT INTO bookmarks (user_id, story_id) VALUES (?, ?)', (user_id, story_id))
        db.commit()
        return jsonify({'bookmarked': True}), 200


@app.route('/api/bookmarks', methods=['GET'])
def get_bookmarks():
    """Get all bookmarked stories for current user."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Please login to view bookmarks.'}), 401
        
    user_id = user['id']
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('''
        SELECT s.*, u.name as author_name 
        FROM bookmarks b
        JOIN stories s ON b.story_id = s.id
        LEFT JOIN users u ON s.author_id = u.id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
    ''', (user_id,))
    rows = cursor.fetchall()
    
    posts = []
    for r in rows:
        posts.append({
            'id': r['id'],
            'title': r['title'],
            'content': r['content'],
            'excerpt': r['excerpt'],
            'category': r['category'],
            'cover_image_url': r['cover_image_url'],
            'cover_image_key': r['cover_image_key'],
            'status': r['status'],
            'author_id': r['author_id'],
            'created_at': r['created_at'],
            'profiles': {
                'name': r['author_name'] or 'Richa Sharma',
                'avatar_url': None
            }
        })
    return jsonify(posts), 200


@app.route('/api/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    """Delete a post by ID."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT author_id FROM stories WHERE id = ?', (post_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({'error': 'Post not found'}), 404

    # Allow if user is admin OR the author of the story
    if user['role'] != 'admin' and row['author_id'] != user['id']:
        return jsonify({'error': 'You do not have permission to delete this post.'}), 403

    cursor.execute('DELETE FROM stories WHERE id = ?', (post_id,))
    db.commit()
    return '', 204


# ════════════════════════════════════════════
#  COMMENTS
# ════════════════════════════════════════════

@app.route('/api/comments/<story_id>', methods=['GET'])
def get_comments(story_id):
    """Fetch comments for a specific story."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT c.*, u.name as user_name 
        FROM comments c 
        LEFT JOIN users u ON c.user_id = u.id 
        WHERE c.story_id = ? 
        ORDER BY c.created_at DESC
    ''', (story_id,))
    rows = cursor.fetchall()
    
    comments_list = []
    for r in rows:
        comments_list.append({
            'id': r['id'],
            'story_id': r['story_id'],
            'user_id': r['user_id'],
            'content': r['content'],
            'created_at': r['created_at'],
            'profiles': {
                'name': r['user_name'] or 'Anonymous User',
                'avatar_url': None
            }
        })
    return jsonify(comments_list), 200


@app.route('/api/comments', methods=['POST'])
def add_comment():
    """Add a comment to a story."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Please login to comment.'}), 401

    body = request.get_json()
    if not body:
        return jsonify({'error': 'Request body is required'}), 400

    if isinstance(body, list):
        body = body[0]

    story_id = body.get('story_id')
    content = body.get('content')
    user_id = user['id']

    if not story_id or not content:
        return jsonify({'error': 'story_id and content are required'}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO comments (story_id, user_id, content)
        VALUES (?, ?, ?)
    ''', (story_id, user_id, content))
    db.commit()
    comment_id = cursor.lastrowid

    cursor.execute('''
        SELECT c.*, u.name as user_name 
        FROM comments c 
        LEFT JOIN users u ON c.user_id = u.id 
        WHERE c.id = ?
    ''', (comment_id,))
    r = cursor.fetchone()

    comment = {
        'id': r['id'],
        'story_id': r['story_id'],
        'user_id': r['user_id'],
        'content': r['content'],
        'created_at': r['created_at'],
        'profiles': {
            'name': r['user_name'] or 'Anonymous User',
            'avatar_url': None
        }
    }
    return jsonify(comment), 201


# ════════════════════════════════════════════
#  ADMIN SETTINGS (Facebook / Instagram URLs)
# ════════════════════════════════════════════

@app.route('/api/admin/profile', methods=['GET'])
def get_admin_profile():
    """Fetch admin's profile info (public endpoint)."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT id, email, name, role, facebook_url, instagram_url 
        FROM users 
        WHERE role = 'admin' 
        ORDER BY id ASC 
        LIMIT 1
    ''')
    row = cursor.fetchone()
    if row:
        return jsonify({
            'id': row['id'],
            'email': row['email'],
            'name': row['name'],
            'role': row['role'],
            'facebook_url': row['facebook_url'] or '',
            'instagram_url': row['instagram_url'] or ''
        }), 200
    return jsonify({'error': 'Admin not found'}), 404


@app.route('/api/admin/profile', methods=['PUT'])
def update_admin_profile():
    """Update admin's profile info (Admin only)."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Not logged in or session expired.'}), 401
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized. Admin privileges required.'}), 403

    body = request.get_json()
    if not body:
        return jsonify({'error': 'Request body is required'}), 400

    facebook_url = body.get('facebook_url', '')
    instagram_url = body.get('instagram_url', '')
    name = body.get('name')
    
    db = get_db()
    cursor = db.cursor()
    
    if name:
        cursor.execute('''
            UPDATE users 
            SET facebook_url = ?, instagram_url = ?, name = ?
            WHERE role = 'admin' AND id = ?
        ''', (facebook_url, instagram_url, name, user['id']))
    else:
        cursor.execute('''
            UPDATE users 
            SET facebook_url = ?, instagram_url = ?
            WHERE role = 'admin' AND id = ?
        ''', (facebook_url, instagram_url, user['id']))
    db.commit()
    
    return jsonify({
        'facebook_url': facebook_url,
        'instagram_url': instagram_url,
        'name': name or user.get('name'),
        'message': 'Admin profile updated successfully.'
    }), 200


# ════════════════════════════════════════════
#  ADMIN USER MANAGEMENT
# ════════════════════════════════════════════

@app.route('/api/admin/users', methods=['GET'])
def get_users():
    """Fetch all registered users (Admin only)."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Not logged in or session expired.'}), 401
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized. Admin privileges required.'}), 403

    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at DESC')
    rows = cursor.fetchall()
    
    users_list = []
    for r in rows:
        users_list.append({
            'id': r['id'],
            'email': r['email'],
            'name': r['name'],
            'role': r['role'],
            'status': r['status'] or 'active',
            'created_at': r['created_at']
        })
    return jsonify(users_list), 200


@app.route('/api/admin/users/<int:target_user_id>/toggle-block', methods=['POST'])
def toggle_block_user(target_user_id):
    """Block or unblock a user by ID (Admin only)."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Not logged in or session expired.'}), 401
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized. Admin privileges required.'}), 403

    if user['id'] == target_user_id:
        return jsonify({'error': 'You cannot block yourself!'}), 400

    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('SELECT status FROM users WHERE id = ?', (target_user_id,))
    target = cursor.fetchone()
    if not target:
        return jsonify({'error': 'User not found'}), 404

    current_status = target['status'] or 'active'
    new_status = 'blocked' if current_status == 'active' else 'active'

    cursor.execute('UPDATE users SET status = ? WHERE id = ?', (new_status, target_user_id))
    db.commit()

    return jsonify({
        'id': target_user_id,
        'status': new_status,
        'message': f'User status updated to {new_status}.'
    }), 200


# ════════════════════════════════════════════
#  AUTHENTICATION
# ════════════════════════════════════════════

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Login with mobile number/email and password."""
    body = request.get_json()
    if not body:
        return jsonify({'error': 'Credentials are required'}), 400
    email = body.get('phone') or body.get('email')
    password = body.get('password')

    if not email or not password:
        return jsonify({'error': 'Mobile number and password are required'}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid mobile number or password'}), 400

    if user['status'] == 'blocked':
        return jsonify({'error': 'Your account has been blocked by the administrator.'}), 403

    token = generate_token(user['id'], user['email'], user['role'])

    return jsonify({
        'accessToken': token,
        'refreshToken': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role'],
            'facebook_url': user['facebook_url'] or '',
            'instagram_url': user['instagram_url'] or ''
        }
    }), 200


@app.route('/api/auth/signup', methods=['POST'])
def auth_signup():
    """Sign up a new user with mobile number/email."""
    body = request.get_json()
    if not body:
        return jsonify({'error': 'Data is required'}), 400
    email = body.get('phone') or body.get('email')
    password = body.get('password')
    name = body.get('name', '')

    if not email or not password:
        return jsonify({'error': 'Mobile number and password are required'}), 400

    db = get_db()
    cursor = db.cursor()

    # Check if user already exists
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        return jsonify({'error': 'Mobile number already registered'}), 400

    hashed_pw = generate_password_hash(password)
    
    # Auto-assign 'admin' role if this is the first registered user
    cursor.execute('SELECT COUNT(*) as count FROM users')
    count = cursor.fetchone()['count']
    role = 'admin' if count == 0 else 'user'

    try:
        cursor.execute('''
            INSERT INTO users (email, password_hash, name, role)
            VALUES (?, ?, ?, ?)
        ''', (email, hashed_pw, name, role))
        db.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Signup failed due to database conflict'}), 400

    token = generate_token(user_id, email, role)

    return jsonify({
        'accessToken': token,
        'refreshToken': token,
        'user': {
            'id': user_id,
            'email': email,
            'name': name,
            'role': role,
            'facebook_url': '',
            'instagram_url': ''
        }
    }), 201


# ════════════════════════════════════════════
#  IMAGE UPLOAD
# ════════════════════════════════════════════

@app.route('/uploads/<filename>')
def serve_upload(filename):
    """Serve uploaded images."""
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/api/upload', methods=['POST'])
def upload_image():
    """Upload an image to local directory."""
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Unauthorized. Please login to upload images.'}), 401
    if user.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized. Admin privileges required.'}), 403

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if file:
        filename = secure_filename(file.filename)
        # Append unique timestamp to prevent name collisions
        name_part, ext_part = os.path.splitext(filename)
        unique_filename = f"{name_part}_{int(datetime.now().timestamp())}{ext_part}"
        
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(file_path)

        # Generate absolute URL based on incoming request host
        file_url = f"{request.host_url}uploads/{unique_filename}"

        return jsonify({
            'url': file_url,
            'key': unique_filename
        }), 200


# ════════════════════════════════════════════
#  SERVE REACT BUILD (Production)
# ════════════════════════════════════════════

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve React build files in production."""
    # Prevent falling back to index.html for non-existent API or upload routes
    if path.startswith('api/') or path.startswith('uploads/'):
        return jsonify({'error': 'Not found'}), 404

    static_folder = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
    if path and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)
    index_path = os.path.join(static_folder, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(static_folder, 'index.html')
    return jsonify({
        'message': 'Richa Sharma Stories SQLite API is running. Build the React frontend for the UI.',
        'database_file': DATABASE
    }), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
