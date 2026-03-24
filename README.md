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
GROQ_API_KEY=your_groq_api_key
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
```

You can also copy from `.env.example`.

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
