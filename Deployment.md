# Deployment Guide

This guide covers deploying the SkillArena Snake Game to production.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- A [Supabase](https://supabase.com/) account
- A [Netlify](https://netlify.com/) account (or similar hosting platform)

## Backend Deployment (Supabase)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com/) and sign in
2. Click "New Project"
3. Fill in your project details and wait for it to be created
4. Note your project URL and anon key from Settings → API

### 2. Login to Supabase CLI

```bash
npx supabase login
```

### 3. Link Your Project

```bash
npx supabase link --project-ref YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your Supabase project reference ID.

### 4. Deploy Database Schema

Push the database migrations to your Supabase project:

```bash
npx supabase db push
```

This will create all the necessary tables:
- `lobbies` - Game lobby management
- `lobby_players` - Players in lobbies
- `matches` - Game match records
- `match_players` - Player stats per match

### 5. Deploy Edge Functions

Deploy the game server edge function:

```bash
npx supabase functions deploy game-server --no-verify-jwt
```

## Frontend Deployment (Netlify)

### 1. Connect Repository

1. Go to [netlify.com](https://netlify.com/) and sign in
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub/GitLab repository

### 2. Configure Build Settings

| Setting | Value |
|---------|-------|
| Build command | `bun run build` or `npm run build` |
| Publish directory | `dist` |

### 3. Set Environment Variables

In Netlify's Site Settings → Environment Variables, add:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project reference ID |

### 4. Deploy

Click "Deploy site" or push to your connected branch to trigger a deployment.

## Local Development

To run the frontend locally against your production Supabase backend:

1. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

2. Install dependencies and start the dev server:

```bash
bun install
bun run dev
```

Or with npm:

```bash
npm install
npm run dev
```

## Troubleshooting

### Edge Function Errors

Check edge function logs:

```bash
npx supabase functions logs game-server
```

### Database Issues

Verify your migrations are applied:

```bash
npx supabase db diff
```

### CORS Issues

Ensure your Supabase project's API settings allow requests from your frontend domain.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│   Supabase       │
│   (Netlify)     │     │                  │
│                 │     │  ┌────────────┐  │
│  React + Vite   │     │  │  Database  │  │
│  Tailwind CSS   │     │  └────────────┘  │
│                 │     │                  │
└─────────────────┘     │  ┌────────────┐  │
                        │  │   Edge     │  │
                        │  │  Functions │  │
                        │  └────────────┘  │
                        └──────────────────┘
```
