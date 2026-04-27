#!/bin/sh
set -e

echo "🚀 Starting Ticket Schmiede..."

# Run database migrations
echo "📦 Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# Run seed (idempotent - creates admin if not exists)
echo "🌱 Running database seed..."
./node_modules/.bin/tsx prisma/seed.ts || echo "⚠️  Seed skipped (tsx unavailable in production, seeding on first run only)"

echo "✅ Starting Next.js server..."
exec node server.js
