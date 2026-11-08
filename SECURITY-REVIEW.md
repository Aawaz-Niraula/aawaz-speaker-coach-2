# Dependency audit — 8 November 2026

`npm audit` reported 20 advisories (2 critical, 5 high) published since the September review, including unauthenticated remote code execution in Next.js (`next/og`, image optimization, `use cache`) and account takeover through OAuth state in Better Auth.

| Package | Before | After | Fixes |
| --- | --- | --- | --- |
| next, eslint-config-next | 16.3.5 | 16.4.5 | RCE (GHSA-vcvr-r3jv-pc5j, GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr), image-optimizer SSRF, cache poisoning, server-action DoS |
| better-auth | 1.7.4 | 1.7.18 | Sign-in as another user via OAuth state (GHSA-965c-763c-88jm) or OAuth proxy (GHSA-r4xp-prcw-77qf) |
| transitive (sharp, zod, vite, brace-expansion, source-map-js, vitest) | | patched by `npm audit fix` | DoS and librsvg issues |

`@tailwindcss/typography` was removed: nothing used its `prose` classes, and the built CSS is otherwise identical. Eight moderate advisories remain, all in the ESLint toolchain, which runs at development time only; npm's suggested fix is a downgrade to an older major version, so it was not applied.

Run `npm audit` before every deploy; this review shows new critical advisories can appear within weeks.

# Follow-up review — 6 November 2026

Follow-up to the September review below. Changes are local and uncommitted; nothing was deployed.

## Fixed

| Priority | Finding | Change |
| --- | --- | --- |
| Medium | **Provider error text and status reached the browser.** Chat, insights, script, voice and transcription routes forwarded the AI provider's own error message and HTTP status. That text can describe the provider account (balance, quota, key state). | Provider text is logged server-side only; browsers get a fixed message and 502/503. See `publicProviderStatus` in `src/lib/ai.ts`. |
| Medium | **Deleted accounts could be repopulated.** Background saves (`after()`) wrote rows for an account deleted mid-request (September item 2). | Account-owned inserts now run only while the `user` row exists. Guest rows are unaffected. |
| Medium | **Account and data deletion needed no recent sign-in** (September item 3). | Both routes require a sign-in from the last 24 hours (Better Auth's own `freshAge` default) and return `reauthRequired`. The UI offers a "Log out" action that reopens sign-in. |
| Medium | **Uploads were buffered before identity and rate checks** (September item 4). | `transcribe-analyze` and `deep-analysis` check the cookie and burst limits before reading the body. |
| Low | **Password policy.** Minimum was 6; change/reset-password skipped the letter-and-number rule. | Minimum is 8 for new passwords (sign-in is unaffected, so existing accounts still work); the rule applies to `/change-password` and `/reset-password`. |
| Low | **Gemini key in the URL query string.** | Sent in the `x-goog-api-key` header. |
| Low | **Arbitrary text in sign-in error toasts.** `/coach?error=<any text>` was displayed verbatim. | Only short error codes are shown; other text gets a generic message. |
| Low | **Model output could crash the Progress tab.** Non-string insight items were rendered as React children. | Only non-empty strings are returned. |
| Low | **Temporary `/report-preview` routes shipped to production.** | 404 in production builds. `dev.log` (containing a LAN address) removed from Git tracking. |

## Usability fixes

- The guest meter ("x / 3 uses") now follows the server: every AI route returns `guestRemaining`, and the session bootstrap returns it on load. Before, chat uses were never counted, insights were counted even when nothing was charged, and cleared storage reset the meter.
- Reaching the guest limit in Aawax chat now opens the sign-up prompt, as it does everywhere else.
- "Delete data" describes what it deletes (reports and practice scripts, not "voice samples") and clears scripts, the open report and insights from the screen.
- Transcription session failures now carry `identityRequired`, so the client refreshes the guest cookie automatically.

## Still open

- Account farming across unverified email signups (September item 1) needs a product decision on email verification and a deployment-wide budget.
- Data deletion (not account deletion) can still be followed by one in-flight save.
- Sign-up reveals whether an email is registered (Better Auth default).

## Verification

172 tests pass (10 new; 8 of them fail against the previous code). TypeScript, ESLint and `next build` pass. The new UI flows were not exercised in a browser.

# Security review — 20 September 2026

Reviewed the current working tree, including the prior uncommitted security and homepage changes. Scope: all 15 API route files, the Better Auth integration, guest identities, database access and ownership, AI provider calls, request parsing, browser rendering and account transitions, dependency advisories, and secret exposure. Changes in this review are local; nothing was deployed.

No new critical remote-code-execution or arbitrary cross-account-access exploit was confirmed. There were additional application security defects despite the clean dependency audit. The fixes below do not make this an assurance that the app has no other vulnerabilities.

## Findings fixed

| Priority | Finding and evidence | Change |
| --- | --- | --- |
| High | **Revoked sessions remained authorized for up to five minutes.** Better Auth's cookie cache returned the cached user without checking whether the database session still existed. An isolated test reproduced successful authorization after deleting the session row. Exploitation requires possession of a previously valid cookie. | Disabled the session cookie cache. A test now issues a cookie under the old configuration, revokes its session, and confirms the current configuration rejects the replay. See [auth.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/auth.ts:77). |
| High, conditional on storage failure | **AI quota enforcement failed open.** Missing storage and counter write failures returned `allowed: true`. Signed guests could still reach paid providers when usage protection was unavailable. Credential throttling also fell back to instance-local counters. | Quota failures now produce a controlled 503 on all six AI routes, before any provider request. Credential requests return 503 when their durable counter is unavailable. Unknown quota names also fail closed. See [db.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/db.ts:254) and [auth route](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/app/api/auth/[...all]/route.ts:138). |
| Medium | **The auth body limit trusted Content-Length.** A valid JSON request over 16 KB without that header reached authentication instead of returning 413. The email-counter parser cloned and buffered the unchecked body. | Bound the body while reading it, before either parser. Missing, understated and oversized declared lengths are covered by regression tests. Credential endpoints also reject ambiguous content types so the email limiter and auth handler parse the same format. See [body.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/body.ts:74). |
| Medium | **Guest claiming reset an old cookie's allowance.** Claiming deleted `guest_usage`; replaying the saved, still correctly signed cookie created a new counter. The existing address quota limited the impact but did not retire the identity's allowance. | The atomic merge now retains a fully spent counter. The saved guest token cannot obtain another three uses. See [db.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/db.ts:414). |
| Medium, browser/proxy dependent | **Origin checks accepted unsafe cases.** `Origin: null` was explicitly allowed, schemes were ignored, and a supplied `x-forwarded-host` could determine the accepted host. Unit tests reproduced each acceptance; this was not a demonstration of a complete browser cookie-theft attack. | Reject opaque origins and cross-site/same-site browser requests, compare complete origins, and use configured deployment origins rather than forwarding headers. Production guest cookies always carry `Secure`. The same guard now runs before auth POST processing. See [identity.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/identity.ts:104) and [origins.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/origins.ts:1). |
| Medium | **Logout retained private content in browser state.** The old logout handler cleared evaluation history but retained scripts, reports, chat, and other buffers. A subsequent user on that page could encounter the previous user's content. | The coach now has a separate component lifetime for each authenticated identity. Logout and account changes discard private state; late responses target the retired component. Microphone acquisition that completes after unmount releases its tracks. Browser verification confirmed a loaded private script is absent after logout. See [coach page](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/app/coach/page.tsx:231). |
| Medium, data loss | **A failed guest merge discarded the only guest cookie.** The route returned success and cleared the cookie even when the database merge returned false. That could strand the guest's saved records. | Failure returns 503 and leaves the cookie intact for retry. See [claim-guest route](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/app/api/account/claim-guest/route.ts:33). |

API responses also now receive `Cache-Control: private, no-store`. This is explicit privacy hardening; a shared-cache disclosure was not reproduced.

Disabling session caching intentionally adds database reads. Counter outages now temporarily stop sign-in or paid AI work instead of bypassing protection. Account changes intentionally discard unsaved browser buffers.

## Remaining risks and decisions

1. **High: account farming can multiply paid usage.** Password accounts need no verified email. Signed-in AI requests have per-account daily quotas, while the per-address daily cap only applies to guests. Route-wide limits and provider concurrency pools live in process memory, so they are not a deployment-wide spending ceiling. An attacker can accumulate accounts over time or across addresses and multiply the per-user allowances. Choose and implement a durable deployment-wide budget and signup-abuse controls; email verification alone is not a complete spending control. Provider-side billing limits were not inspected or changed. Relevant code: [consumeUsage](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/app-user.ts:102), [rate-limit.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/rate-limit.ts:1), and [fetch.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/fetch.ts:1).
2. **Medium: deletion is not coordinated with in-flight generation.** Transcription and speech generation schedule inserts after generating their results. The insert helpers do not check an account-deletion marker or a data-deletion generation. A request admitted before deletion can therefore persist data after the delete transaction. Fix with a durable deletion generation/tombstone checked atomically on save, including guest-to-account ownership changes. This is a code-path finding; a concurrent live-browser deletion test was not performed. Relevant code: [transcribe-analyze](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/app/api/transcribe-analyze/route.ts), [generate-speech](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/app/api/generate-speech/route.ts), and [database writes](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/db.ts).
3. **Password and destructive-action policy remains weak.** Minimum password length is still six. The custom account/data deletion routes require a valid session but no fresh authentication; sessions can last 30 days. Consider stronger passwords and recent sign-in for destructive operations. Email verification needs a configured delivery/recovery flow and was not silently enabled.
4. **Rate-limit deployment assumptions matter.** Address keys trust forwarded headers. Vercel documents overwriting `X-Forwarded-For`; a directly exposed Node server or differently configured proxy needs an explicit trusted-proxy policy. Instance-local burst limits should not be described as global limits. Large audio bodies are also parsed before identity/rate checks, leaving avoidable work under unauthenticated upload floods. [Vercel request-header documentation](https://vercel.com/docs/headers/request-headers).
5. **The previously identified policy tradeoffs remain.** Five login attempts per address can affect a shared school network. A nonce-based script CSP has not been added. Existing framing, object, and base-URI restrictions remain in place.

## Verification

- **160 tests pass**, including **38 new security tests**. Nine assertions failed against the original working-tree behavior before fixes. New coverage includes body byte limits, origin checks, guest integrity/replay, legacy cached-session revocation, database-failure behavior, the sixth-login lockout, concurrent quota updates, guest merge failure, and cross-account read/update/delete attempts.
- All six AI routes were tested against an isolated in-memory database with quota failures injected. Each returned 503 without calling an external provider.
- TypeScript, lint, production build, and whitespace checks pass.
- A locally served production build used a temporary SQLite database, synthetic account, and dummy/empty provider credentials. Eight HTTP smoke checks passed: security headers, signup, private-response cache policy, owner access, rejection of null and hostile origins, chunked oversized auth rejection, and forged-cookie isolation.
- The browser test loaded a private fixture script, logged out, and verified the guest view contained no scripts. No paid generation or real account data was used.
- `npm audit --json` reports **zero known vulnerabilities** across the root dependency tree. Installed versions inspected: Next.js 16.3.5, Better Auth 1.7.4, React/React DOM 19.2.0. The Next.js version is newer than the August security fixes; the installed Better Auth code includes the local-email verification gate for implicit OAuth linking. [Next.js advisory](https://nextjs.org/blog/august-2026-security-release), [Better Auth advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-g38m-r43w-p2q7).
- SQL value inputs remain parameterized and private record operations are scoped to server-resolved ownership. No confirmed SQL injection, arbitrary outbound URL/SSRF, or user-controlled HTML execution sink was found in the reviewed application paths. The JSON-LD HTML insertion escapes `<`; other reviewed user/model output is rendered as React text.
- No configured secret values were found in tracked files or compiled browser assets. Common credential-pattern scanning also found no matches in tracked text. The checked `.env` filenames do not appear in Git history. This was not an exhaustive scan of every historical blob or provider log.

Tests are in [security.integration.test.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/security.integration.test.ts), [identity.test.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/identity.test.ts), and [body.test.ts](/Users/aawazniraula/Desktop/aawaz-speaker-coach-2/src/lib/body.test.ts).

The public deployment, DNS/TLS configuration, hosting permissions/firewall, production database permissions/backups, Google OAuth console settings, provider billing limits, and live account recovery were not inspected. Media-production directories and the separate static `declare-site` project are not served as part of this Next.js application. This review does not include a production load test or external penetration test.
