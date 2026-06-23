# UTN Tracker

A progressive web app to track academic progress through a Systems Engineering degree at UTN (Universidad Tecnológica Nacional). It works offline, syncs across devices, sends study reminders, and includes a built-in AI assistant.

**Live demo:** https://utn-tracker2.vercel.app

<!-- Tip: add a screenshot or short GIF here. It's the first thing a reviewer looks at. -->

## Overview

Keeping track of subjects, correlatives, grades, and what you can actually enroll in next is a mess when it lives in spreadsheets and PDFs. UTN Tracker centralizes that: you log your subjects and grades, and the app shows your progress, what's unlocked, and what's left, with reminders so deadlines don't slip. It's offline-first, so it stays usable with a bad connection and syncs when you're back online.

## Features

- **Progress tracking** for subjects, grades, and correlatives across the degree plan.
- **Offline-first**: a local cache keeps the app working without connection, and changes sync to the backend when it returns.
- **Installable PWA** with a service worker — install it on your phone like a native app.
- **Web Push notifications** for reminders, including a scheduled job that sends them automatically.
- **Pomodoro mode** for focused study sessions.
- **AI study assistant** with multiple model providers (see below).
- **File storage** for notes and materials, served through signed URLs.

## Architecture

The frontend is a React + Vite single-page app. The backend is a set of serverless functions deployed on Vercel, with Supabase (Postgres) as the database and Cloudflare R2 for file storage.

- **Auth & data**: Supabase, with Row Level Security so each user only reads and writes their own rows.
- **File storage**: Cloudflare R2 (S3-compatible). Uploads and downloads go through presigned URLs generated server-side, so credentials never reach the client.
- **Notifications**: Web Push (VAPID). A scheduled cron function sends reminders without the app being open.
- **Secrets split**: only public values are exposed to the client (`VITE_` prefix). Service keys and private VAPID keys live server-side only.

## Serverless functions (`/api`)

- `chat.js` — AI assistant; routes requests to the selected model provider.
- `upload.js` / `download.js` — presigned R2 upload and download.
- `notify.js` — registers push subscriptions and sends notifications.
- `cron.js` — scheduled job that pushes reminders.
- `_utils.js` — shared helpers (method/env validation, error responses).

## AI assistant

The chat assistant supports three providers, each loaded only when selected:

| Model | Provider |
|-------|----------|
| Claude Sonnet 4 | Anthropic |
| GPT-4o mini | OpenAI |
| Gemini 1.5 Flash | Google |

## Tech stack

- **Frontend**: React, Vite
- **Backend**: Vercel serverless functions (Node.js)
- **Database**: Supabase (Postgres + RLS)
- **Storage**: Cloudflare R2 (`@aws-sdk/client-s3`)
- **Notifications**: Web Push (`web-push`, VAPID)

## Getting started

### Requirements

- Node.js 18+
- A Supabase project, a Cloudflare R2 bucket, and (optionally) API keys for the AI providers you want to use.

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```bash
# Client (exposed to the browser)
VITE_SUPA_URL=
VITE_SUPA_ANON=
VITE_VAPID_PUBLIC_KEY=
VITE_MAIN_USER_ID=

# Server only (never exposed)
SUPABASE_SERVICE_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
CRON_SECRET=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# AI providers (only the ones you use)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

### Run

```bash
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview the build
```

The database schema and RLS policies live in `supabase/rls.sql`.