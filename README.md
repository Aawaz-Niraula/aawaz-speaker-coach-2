# Aawaz Speaker Coach

This app now supports:

- Persistent speech history
- History-aware evaluations that compare your latest speech with previous weak spots
- Brutal, more technical feedback with drills and direct fixes
- Template-based evaluation for 4 speech formats
- General evaluation when no template is selected, using ELP and the 20/60/20 structure rule

## Database choice

This setup is prepared for **Turso** because it has a generous free tier and does not require card details to get started.

## Environment variables

Create a `.env.local` file with:

```bash
DEEPINFRA_API_KEY=your_deepinfra_api_key
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
BETTER_AUTH_SECRET=a_long_random_secret
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

For Google sign-in, configure the OAuth client as a **Web application** and add these authorized redirect URIs:

- `https://speaker-coach.aawax.me/api/auth/callback/google` for production
- `http://localhost:3000/api/auth/callback/google` for local development

Add the matching origins (`https://speaker-coach.aawax.me` and `http://localhost:3000`) under authorized JavaScript origins. The redirect URI must match exactly, including the protocol, hostname, port, and `/api/auth/callback/google` path.

## Turso setup

1. Create a free Turso account.
2. Create a database.
3. Get the database URL.
4. Create an auth token for that database.
5. Put those values into `.env.local`.

The app auto-creates the `speech_sessions` table on first use, so no manual SQL migration is required.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## How history works

- Each browser gets a stable local user id saved in `localStorage`.
- Every evaluation is stored in Turso with transcript, feedback, score, speed, and template mode.
- Future evaluations include recent sessions in the prompt so the coach can spot repeated mistakes.
