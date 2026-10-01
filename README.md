# 💌 Anony — Full-Stack Anonymous Messaging Web App

A modern, mobile-first anonymous messaging application (clone-style "send me anonymous messages" app) built with **Next.js (App Router, Next.js 16)**, **TypeScript**, **Tailwind CSS**, and **Supabase (Auth, Postgres, RLS, Realtime & Edge Functions)**.

---

## ✨ Features

- 🔗 **Personal Public Link (`/u/[username]`)**: Anyone with your link can send you anonymous messages without creating an account or logging in.
- 📬 **Live Protected Inbox (`/inbox`)**: Real-time sync via Supabase Realtime when new messages arrive without needing a page refresh.
- 🎨 **Instagram & Snapchat Story Cards**: Export stylish 9:16 vertical gradient cards tailored for social media stories in one click (Download PNG or Copy Image to Clipboard).
- 🛡️ **Multi-Tier Abuse & Spam Protection**:
  - **Bot Honeypot**: Hidden inputs that trap automated bot submissions.
  - **Edge Rate Limiting**: Max 5 messages per device per recipient per hour, and 20 per IP per hour.
  - **Automated Moderation**: Filters phone numbers, email addresses, external links, and harassment blocklist terms.
  - **Cryptographic Anonymity**: Sender IPs and client device IDs are salted and hashed using SHA-256 (`ip_hash`, `device_hash`) and stored strictly in a client-inaccessible metadata table.
  - **In-App Device Blocking**: Recipients can block an abusive sender's device from their inbox without ever exposing the sender's device identifier.
  - **Abuse Reporting**: Direct report submission for moderation review.
- 📱 **Mobile-First Ergonomics**: Designed and tested down to 375px screens with haptic visual feedback, optimistic UI, and dark mode.

---

## 🏗️ Architecture & Security Model

```
Browser (/u/[username])
       │
       ▼
Supabase Edge Function (send-message) / Next.js API Bridge
       │  - Zod payload validation
       │  - Honeypot check
       │  - SHA-256 salting (ip_hash, device_hash)
       │  - Blocked devices check
       │  - Rate limits (5 msgs/dev/recipient/hr, 20 msgs/IP/hr)
       │  - Content moderation (regex + blocklist)
       ▼
Supabase Postgres (Service Role)
       ├─► public.messages (recipient_id, body, is_read)
       └─► public.message_meta (message_id, device_hash, ip_hash) [ZERO CLIENT ACCESS]
```

### Row Level Security (RLS) Boundaries
- `messages`: Authenticated owners can `SELECT`, `UPDATE` (`is_read` column only, enforced by trigger), and `DELETE` messages where `recipient_id = auth.uid()`. **NO insert policy for client roles** (inserts happen exclusively via service role in the Edge Function / backend).
- `message_meta`, `rate_limits`, `blocked_devices`: **Zero client access**. Sender-identifying data is never exposed to the client.
- `profiles`: Public view `public_profiles` exposes only safe columns (`id`, `username`, `created_at`). Users can update only their own profile.
- `realtime`: Enabled on `messages` table respecting RLS filters.

---

## 🚀 Setup & Deployment Guide

### 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. In your Project Settings -> **API**, copy:
   - **Project URL**
   - **anon / public key**
   - **service_role key** (keep this secret!)

### 2. Run Database Migrations
Go to your Supabase project dashboard -> **SQL Editor**, and run the migration script:
- Copy and run: [`supabase/migrations/20261001000000_initial_schema.sql`](file:///supabase/migrations/20261001000000_initial_schema.sql)

This creates:
- `profiles`, `messages`, `message_meta`, `rate_limits`, `blocked_devices`, `reports`
- RLS policies on all tables
- Owner device-blocking RPC function `block_sender_by_message_id`
- User signup trigger `on_auth_user_created`
- Realtime publication on `messages`

*(Optional)* Run seed data:
- Copy and run: [`supabase/seed.sql`](file:///supabase/seed.sql)

*(Optional)* Run the RLS policy verification test suite:
- Copy and run: [`supabase/tests/rls_test.sql`](file:///supabase/tests/rls_test.sql)

---

### 3. Deploy the Supabase Edge Function (`send-message`)

If using the Supabase CLI:
```bash
# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Set Edge Function secrets
npx supabase secrets set HASH_SALT="your-super-secret-salt-at-least-32-chars"
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Deploy function
npx supabase functions deploy send-message --no-verify-jwt
```

> **Note**: An identical Next.js API route bridge is also built-in at `/api/send-message`. If you run locally or before deploying the edge function, the public send page seamlessly routes through `/api/send-message`.

---

### 4. Configure Environment Variables

Create `.env.local` based on `.env.example`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Secret salt for SHA-256 IP & device fingerprinting
HASH_SALT=your-random-secure-string-at-least-32-chars

# Push notifications (Optional FCM stub)
FCM_SERVER_KEY=
```

---

### 5. Run Locally

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

### Automated Unit Tests
Run the built-in moderation and hashing test suite:
```bash
npm test
```
Tests:
- Rejection of phone numbers in local and international formats
- Rejection of email addresses
- Rejection of URLs and links
- Rejection of blocklisted harassment words and threats
- Deterministic, irreversible salted SHA-256 hashing

### RLS Security Tests
Run [`supabase/tests/rls_test.sql`](file:///supabase/tests/rls_test.sql) in your Supabase SQL Editor to verify:
1. Anon users cannot read messages (0 rows returned).
2. Users cannot read another user's inbox messages.
3. Users can read their own received messages.
4. Direct client inserts into messages are rejected.
5. Client cannot read `message_meta`, `rate_limits`, or `blocked_devices`.
6. Public profile view works safely without exposing sensitive columns.

---

## 📱 Pages & Routes

| Route | Description | Protection |
|---|---|---|
| `/` | Landing page with hero, interactive preview, and feature highlights | Public |
| `/login` | Supabase Auth login with email/password + Google OAuth | Public (redirects if logged in) |
| `/signup` | Account creation with custom username and Google OAuth | Public (redirects if logged in) |
| `/u/[username]` | Public anonymous message submission page with 500-char counter and abuse notice | Public (No login needed) |
| `/inbox` | Live inbox with Realtime sync, unread badge, delete, story export, report & block | Protected (Auth required) |
| `/settings` | Update username, copy public link, toggle notifications, delete account | Protected (Auth required) |
| `/api/send-message` | Secure send-message endpoint with rate limiting, hashing & moderation | Public |
| `/api/block-sender` | Owner-initiated device block endpoint | Protected |
| `/api/delete-account` | Permanent account deletion endpoint | Protected |
