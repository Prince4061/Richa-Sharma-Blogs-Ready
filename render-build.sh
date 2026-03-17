#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Installing Frontend Dependencies..."
npm install --prefix frontend

echo "==> Building Frontend..."
npm run build --prefix frontend

echo "==> Installing Backend Dependencies..."
pip install -r backend/requirements.txt

echo "==> Build Complete!"
