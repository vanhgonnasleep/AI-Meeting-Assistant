# Source organization

Group code that changes together by feature, keep infrastructure shared, and keep tests beside the behavior they verify. Existing startup commands remain valid.

```text
ai-summary-service/
  main.py                       thin compatibility entry: python main.py / uvicorn main:app
  app/
    main.py                     FastAPI composition and orchestration
    api/                        saved-session and task/project/review routes
      schemas/                  chat, meeting, bounded IDs and workspace request contracts
    auth/                       configuration, providers, sessions, middleware, routes
    core/                       request budgets, storage error boundary and runtime configuration
    pipeline/                   transcription, audio preparation, MMR, chat, insights, actions
      summarization.py          bounded direct/map-reduce algorithm with injected generation
    fixtures/                   explicit demonstration content
  tests/                        API, algorithm, account-isolation and model regressions
  requirements*.txt
database/                       shared storage implementation: schema, CRUD, dates, profiles
meeting-assistant-ui/
  src/
    main.jsx                    browser entry
    app/                        shell, private navigation, public entry routes, composition
    features/
      auth/                     session gate, account-safe HTTP client and tests
        components/             provider sign-in controls
      meetings/                 document, editor, library, persistence and session helpers
      chat/                     streaming and command dock
      recording/                capture lifecycle, upload and sample handling
      workspace/                tasks, projects and review workflows
      overview/                 dashboard and analytics helpers
      landing/                  public product presentation and demonstrations
        components/             landing navigation and presentation sections
      preview/                  public workspace; no private data API calls
        components/             overview, meeting detail, task and project panels
        data/                   explicitly prepared client-only sample fixtures
      connectors/               GitHub issue/Gmail draft previews
    shared/{ui,hooks,lib,assets}/
      ui/FeedbackNotice.jsx     accessible floating error/success notifications
      lib/user-errors.js        business-language recovery messages and failure classification
    styles/                     global styles and preserved palette
  scripts/test.mjs              recursive Node test discovery, including Windows
  tests/public-preview-mobile.html   375px manual responsive QA fixture
docker/                         nginx and disposable smoke override
scripts/                        maintenance, benchmark and container verification
  submission/                   clean, commit-addressed source archive builder
docs/                           setup, usage, design, acceptance and measurements
  defense/                      technical defense and presentation guides
  submission/                   English submission checklist and presenter handoff
  reports/                      archived midterm HTML/PDF
```

The root Dockerfiles/Compose file and Windows launchers remain easy to find. Python's root `main.py` aliases the real `app.main` module when imported so test/tool monkeypatches still affect live application globals. Other old flat backend modules have moved; import their `app.*` paths directly.

The storage package is source code; generated account data belongs in ignored data directories. Do not commit `.env`, SQLite files/sidecars, model caches, node_modules or virtual environments.

Public experience: `/` introduces the product, `#/preview/overview` explores sample data, and `#/signin` opens provider sign-in. A fresh preview does not mount the private application, including for an already signed-in visitor. If the visitor explicitly opened a private workspace first, that account's App remains mounted and hidden while previewing so recordings, requests and unsaved results survive; sign-out/account changes remove it. The preview itself reads only its fixtures. Private page names and API authorization are unchanged. Preview state lives only in its mounted component; entering the real workspace never imports sample meetings into an account. Preview/auth styles are colocated with their features; shared product styles remain in `src/styles/`.

Tailwind 4 uses `@tailwindcss/vite`; compatibility styles preserve the existing palette and control defaults. Before integrating changes, run backend regressions, `npm test`, `npm run lint`, `npm run build`, and the complete `npm audit`, including development tooling.
