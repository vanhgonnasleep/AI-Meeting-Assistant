# Private sign-in and organized application

## Accepted intent

Finish the rescue's outstanding verification and dependency work, add Google (Gmail account) and GitHub sign-in, and group source files by responsibility. The user explicitly selected a separate meeting library for each account. Work continues in the current session, with local integration after verification; no remote publishing is requested.

## Design

- Use backend OAuth authorization-code flow with PKCE S256 and browser-bound, expiring, single-use state. Google requests only openid/email/profile; GitHub requests only identity/email. No Gmail messages or repository access.
- Use opaque, server-side, expiring sessions in an identity SQLite database. Store only a hash of session tokens. Cookies are HttpOnly, SameSite=Lax, Secure outside loopback development. Unsafe requests require an allowed Origin and a session-bound CSRF header.
- Accounts are keyed by provider and provider subject, never automatically merged by matching email. Tokens used to identify the user are not persisted.
- In private mode, require a session for all meeting, inference and workspace endpoints. Public health and auth status disclose no meeting data. An explicit local mode retains the single-user workflow for offline use and existing regression fixtures.
- Select a separate SQLite file for each authenticated account through a request-scoped ContextVar. Projects, meetings, FTS, chat and voice profiles then share the same isolation boundary. Keep the original local database intact and do not automatically claim it for a new account.
- Add an authentication gate above the app state owner, a Google/GitHub sign-in screen, account status and logout. Credentialed requests carry CSRF for mutations. Logout/session expiry clears the mounted account workspace before another account can use it.
- Provider client credentials and public callback URL come from server environment configuration. Provide an example and exact setup steps; never request secrets in chat or commit them. Provider buttons explain unavailable configuration. Actual provider consent needs owner-created OAuth clients.
- Organize frontend into app, features, shared and styles, colocating behavior/tests. Organize backend into an application package with api, auth, core and services/pipeline responsibilities; maintain thin compatibility entry points for existing commands/imports where necessary.
- Migrate the frontend build to patched Tailwind tooling, checking existing appearance, responsive behavior, lint, tests and production build. Avoid cosmetic redesign.
- Validate Docker installation, Compose build, API/nginx/SSE/audio smoke and persistence after restart using an isolated Compose project and temporary host data. Do not attach smoke runs to the user's meeting database. Architecture builds are claimed only when actually run.

## Alternatives considered

1. One database with owner columns: workable, but every current SQL path and future query would require correct tenant predicates, including projects, FTS and voice profiles.
2. One database per account (selected): contains existing SQL within a clear isolation boundary and avoids rewriting established data contracts; backup/maintenance must name the selected file.
3. External managed identity/database: adds external operational dependencies outside the current local application's needs.

## Acceptance and limits

Regression tests must cover login/state replay and expiry, invalid callbacks, logout/revocation, CSRF, concurrent account isolation, direct-ID access, projects/search/chat/voice profiles, and an unchanged legacy database. Run full backend with local models, a clean lightweight environment, frontend tests/lint/build/audit and available Docker checks. External provider consent cannot be called verified without configured OAuth clients. Docker cannot be called verified until an engine is reachable.
