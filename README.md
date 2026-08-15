# Frequency — Phase 1 (matching + live text chat)

This is a real, working starting point: two people can open the site,
get randomly paired, and chat live. No coins, Premium, or voice yet —
those come next, once this core loop is proven out.

## What's in here
- `app/page.js` — the whole app: sign-in, matching, chat
- `lib/supabaseClient.js` — connects the app to your database
- `supabase/schema.sql` — sets up your database tables and rules
- `.env.local.example` — template for your secret keys

## Option A — let Claude Code do it (recommended)

Open Claude Code (same account, different app — desktop, or the Claude
mobile app can drive it remotely) and say something like:

> "Set up a free Supabase project for me, run the SQL in
> supabase/schema.sql, add the keys to .env.local, install
> dependencies, and deploy this to Vercel."

Claude Code can create accounts with you, run the actual commands, and
ask you to confirm anything sensitive (like connecting a real payment
account later). This avoids typos and is much easier if you've never
used a terminal before.

## Option B — do it by hand

**1. Create a Supabase project** (your database — free)
- Go to supabase.com → New Project
- Pick any name and password (save the password somewhere)
- Wait ~2 minutes for it to finish setting up

**2. Set up the database tables**
- In your new project, click "SQL Editor" on the left
- Open `supabase/schema.sql` from this folder, copy everything in it
- Paste into the SQL Editor and click "Run"
- You should see "Success. No rows returned"

**3. Turn on anonymous sign-in**
- In Supabase: Authentication → Providers → Anonymous → turn it on

**4. Get your keys**
- In Supabase: Settings → API
- Copy the "Project URL" and the "anon public" key
- In this project folder, copy `.env.local.example` to a new file
  named `.env.local`, and paste your two values in

**5. Run it locally to test**
- You'll need Node.js installed (nodejs.org — get the LTS version)
- In a terminal, inside this folder, run:
  ```
  npm install
  npm run dev
  ```
- Open http://localhost:3000 — open it in two different browser
  windows (or one normal + one incognito) to test matching with
  "yourself" as two people

**6. Put it online**
- Push this folder to a new GitHub repository
- Go to vercel.com → New Project → import that repository
- When it asks for environment variables, add the same two from your
  `.env.local` file
- Click Deploy — you'll get a live URL in about a minute

## What's next (in rough order)
1. **Coins & the gender-filter cost** — a `coins` column on profiles,
   deducted when picking Male/Female instead of Any
2. **Ratings, the 12-hour ban rule, icebreakers, avatars** — same
   patterns as the interactive prototype, wired to real tables
3. **Signup with real accounts** (so people can return and keep their
   coins/friends) — Supabase supports email/phone sign-in alongside
   anonymous
4. **Friends & premium messaging limits**
5. **Payments** — Stripe (or Razorpay for India) for the Premium
   subscription; needs a business/merchant account
6. **Voice calls** — a service like Agora, Twilio, or Daily.co handles
   the actual audio; your app just requests a call token from them

Each of these is a manageable chunk on its own — happy to build the
next one whenever you're ready.
