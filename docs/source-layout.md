# Source organization

Group code that changes together by feature, keep infrastructure shared, and keep tests beside the behavior they verify. Existing startup commands remain valid.

```text
ai-summary-service/
  main.py                       thin compatibility entry: python main.py / uvicorn main:app
  app/
    main.py                     FastAPI composition and orchestration
    api/                        saved-session and task/project/review routes
    auth/                       configuration, providers, sessions, middleware, routes
    core/                       request budgets and runtime configuration
    pipeline/                   transcription, audio preparation, MMR, chat, insights, actions
    fixtures/                   explicit demonstration content
  tests/                        API, algorithm, account-isolation and model regressions
  requirements*.txt
database/                       shared storage implementation: schema, CRUD, dates, profiles
meeting-assistant-ui/
  src/
    main.jsx                    browser entry
    app/                        shell, navigation, sidebar, application composition
    features/
      auth/                     sign-in gate, account-safe HTTP client and tests
      meetings/                 document, editor, library, persistence and session helpers
      chat/                     streaming and command dock
      recording/                capture lifecycle, upload and sample handling
      workspace/                tasks, projects and review workflows
      overview/                 dashboard and analytics helpers
      landing/                  public product presentation and demonstrations
      connectors/               GitHub issue/Gmail draft previews
    shared/{ui,hooks,lib,assets}/
    styles/                     global styles and preserved palette
  scripts/test.mjs              recursive Node test discovery, including Windows
docker/                         nginx and disposable smoke override
scripts/                        maintenance, benchmark and container verification
docs/                           setup, usage, design, acceptance and measurements
  defense/                      technical defense and presentation guides
  reports/                      archived midterm HTML/PDF
```

The root Dockerfiles/Compose file and Windows launchers remain easy to find. Python's root `main.py` aliases the real `app.main` module when imported so test/tool monkeypatches still affect live application globals. Other old flat backend modules have moved; import their `app.*` paths directly.

The storage package is source code; generated account data belongs in ignored data directories. Do not commit `.env`, SQLite files/sidecars, model caches, node_modules or virtual environments.

Tailwind 4 uses `@tailwindcss/vite`; compatibility styles preserve the existing palette and control defaults. Before integrating changes, run backend regressions, `npm test`, `npm run lint`, `npm run build`, and the complete `npm audit`, including development tooling.
