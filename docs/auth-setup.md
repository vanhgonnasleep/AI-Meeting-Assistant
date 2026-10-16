# Google and GitHub sign-in

Private mode is the default. Every account has a separate meeting library, projects, chat and voice profiles. Google sign-in accepts a Google account, including Gmail accounts; it does not request Gmail messages. GitHub sign-in requests profile and email access, without repository permissions.

The product home and `#/preview/overview` are public: visitors can inspect prepared sample meetings, tasks and projects before signing in, including when the backend is unavailable. This is a client-only preview, not access to the legacy local library or an account. `#/signin` opens Google/GitHub sign-in. Private deep links still require a valid session. Sample changes reset when leaving preview and are never saved to a private library.

## Configure the server

Copy the repository's `.env.example` to `.env`, then fill in the four provider variables locally:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

The populated file is ignored by Git and excluded from Docker build contexts. Never put these secrets in `VITE_*` variables. The Python compatibility entry point loads the root `.env`; explicitly supplied environment variables take precedence. Docker Compose reads the same file and passes credentials only to the backend.

For direct Python/Vite development, keep:

```dotenv
CLARION_AUTH_MODE=private
CLARION_PUBLIC_URL=http://localhost:8002
CLARION_FRONTEND_URL=http://localhost:5173
```

For Docker Compose, both public URLs use nginx's frontend port:

```dotenv
CLARION_AUTH_MODE=private
CLARION_PUBLIC_URL=http://localhost:5173
CLARION_FRONTEND_URL=http://localhost:5173
```

Use the same hostname in the browser and both settings. `localhost` and `127.0.0.1` have separate cookies. If changing the UI origin, set `CORS_ORIGINS` to that origin as well. HTTPS is required outside loopback development. Set `CLARION_ALLOWED_HOSTS` to the deployment's actual hostname; serve the frontend and API on that hostname through an HTTPS reverse proxy.

## Register provider applications

For Google, create an OAuth client of type **Web application**, configure the consent screen/test users, and register the exact callback below. Use the resulting client ID and secret in `.env`. Follow [Google's web-server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server).

For GitHub, register an OAuth App in the developer settings, set the homepage to the frontend URL and callback to the exact URL below, and place its ID/secret in `.env`. See [GitHub OAuth authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

| Provider | Direct development callback | Docker callback |
| --- | --- | --- |
| Google | `http://localhost:8002/api/auth/google/callback` | `http://localhost:5173/api/auth/google/callback` |
| GitHub | `http://localhost:8002/api/auth/github/callback` | `http://localhost:5173/api/auth/github/callback` |

Use separate registered clients when a provider permits only one callback and both deployment styles are needed. Restart the backend after configuration changes. The sign-in page enables each provider only when both its ID and secret are configured. Without credentials, private APIs remain inaccessible and the UI explains that setup is required.

## Accounts, sessions and existing data

- Provider and stable provider subject identify an account. Matching email addresses do not merge Google and GitHub libraries automatically.
- Sessions expire after 24 hours. The HttpOnly cookie contains an opaque token; SQLite stores its hash. Logout revokes it. OAuth state expires after 10 minutes, is bound to the initiating browser and is consumed once. Authorization uses PKCE S256.
- Mutations require both the configured frontend Origin and a session-bound CSRF header. Requests from a previous browser account are discarded, and switching accounts remounts the application state.
- Manually entered GitHub connector tokens are kept only while the connector dialog is open. Older globally cached token/repository keys are removed at startup and account boundaries.
- `CLARION_DATA_DIR/identity.db` stores identity/session metadata. Each user's complete library is `CLARION_DATA_DIR/users/<account-id>/meeting.db`. Back up the entire data directory, including identity metadata, using SQLite-safe backups or with the backend stopped. Provider tokens are not persisted.
- Direct development defaults private data to the root `data/` directory. Docker stores it in the mounted `/app/data` directory (host `CLARION_DATA_PATH`, default `database/`).
- The original `database/meeting.db` remains the legacy local library. It is not assigned to the first person signing in. For administrative import, identify the intended account ID from `/api/auth/session`, stop the backend, back up both libraries, then explicitly restore a local backup into that account's database using `scripts/manage_db.py` with `CLARION_DB_PATH` set to the account's exact path. `--restore` replaces the selected destination, so select an empty/new account library and retain both backups. No automatic import runs at startup.
- `CLARION_AUTH_MODE=local` explicitly selects the original offline, single-user workflow without sign-in. Keep it on loopback; it does not provide account isolation. Existing legacy regression tests and disposable container smoke fixtures select this mode deliberately.

Actual Google/GitHub consent requires owner-created OAuth clients and a human account. Automated tests substitute the provider HTTP identity step; they do not establish that a particular external OAuth client is configured correctly.

Both actual provider flows were verified locally on 2026-10-16 after the owner configured the clients and completed consent. See [the acceptance report](PRIVATE_AUTH_ACCEPTANCE_2026-10-16.md). Other installations and callback origins still need their own live verification.

## Reproduce browser account-isolation QA

Run `ai-summary-service/venv/Scripts/python.exe ai-summary-service/tests/fixtures/browser_auth_server.py` from the repository root. In another terminal, run Vite on `localhost:5185` with `VITE_API_BASE_URL=http://localhost:8882`. The fixture substitutes only the external provider steps, creates temporary Alice/Google and Bob/GitHub libraries, and uses the actual callbacks, cookies, session checks and private APIs. Verify Alice's library, sign out, sign in as Bob and verify the absence of Alice's records. Close/reopen a connector dialog to verify its manually entered token and repository are cleared. Do not submit issues or email for this test. Stop the fixture with Ctrl+C; it does not use the working meeting database.
