# Apple Dynamic Glass UI & Executive Connectors Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Apple Dynamic Glass UI mode transitions (Studio Editor, Zen Slide Deck Presentation, Split Inspector) and Executive Connectors Hub (GitHub Issues Sync & Gmail Executive Dispatch).

**Architecture:** Pure modular frontend components (`PresentationDeck.jsx`, `ConnectorsModal.jsx`, `connectors.js`) with isolated test suites, integrated seamlessly into `DocumentWorkspace.jsx` and `App.jsx` without backend modifications or teammate branch conflicts.

**Tech Stack:** React 19, TailwindCSS v3.4, Framer Motion v13, Lucide React, Node.js test runner (`node --test`).

**Spec:** `specs/2026-10-11-apple-dynamic-glass-ui-connectors.md` (or artifact `specs/2026-10-11-apple-dynamic-glass-ui-connectors.md`)

## Global Constraints

- Zero teammate conflicts: do not touch `ai-summary-service/` or teammate branches (`feat/be-streaming-fts`, `feat/ai-speech-pipeline`, `feat/fe-ui-interactions`).
- All token and configuration data (e.g. GitHub PAT) must remain strictly in browser `localStorage`, never sent to any external or backend server.
- Web URL dispatchers (Gmail, GitHub issue URL fallback) must properly encode URI components to avoid truncation or injection.
- WCAG AA accessibility: all interactive controls must have explicit focus rings, keyboard navigability (Esc, Arrow keys, Enter), and contrast compliance.
- 100% English UI consistency across all newly created components.

## Review Focus

- Long meeting titles, special characters, or multi-line tasks must not break GitHub issue URL encoding.
- Empty attendees or missing emails must gracefully fall back to attendee names without crashing email composer.
- Zen slide deck keyboard navigation (ArrowLeft/ArrowRight/Esc) must attach cleanly and unbind on component unmount to prevent memory leaks.
- Switching between Studio, Zen Slide Deck, and Split Inspector modes must preserve active audio playback and scrub position without resetting audio element.
- GitHub token authentication failures must produce clear, actionable feedback with zero token leakage.

---

### Task 1: Connectors Logic & Unit Tests (`connectors.js` & `connectors.test.js`)

**Files:**
- Create: `meeting-assistant-ui/src/connectors.js`
- Create: `meeting-assistant-ui/src/connectors.test.js`

- [ ] Write failing unit tests in `src/connectors.test.js` for:
  - `buildGitHubIssuePayload`: Task name, assignee in body, labels, meeting citation.
  - `buildGitHubIssueUrl`: Zero-token browser fallback URL generation with proper URI encoding.
  - `buildGmailDispatchUrl`: Subject, structured executive body, recipient list, web URL vs mailto URI.
  - `formatEmailMinutes`: Executive Brief vs Comprehensive Minutes template formatting.
- [ ] Run `node --test src/connectors.test.js` and confirm failure.
- [ ] Implement `src/connectors.js` with pure helper functions, URI encoders, and GitHub API request wrappers.
- [ ] Run `node --test src/connectors.test.js` and confirm all tests pass.

---

### Task 2: Executive Connectors Modal Component (`ConnectorsModal.jsx`)

**Files:**
- Create: `meeting-assistant-ui/src/ConnectorsModal.jsx`

- [ ] Implement `ConnectorsModal.jsx` featuring:
  - Frosted glass modal sheet styling (`bg-slate-900/85 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl`).
  - Tab navigation between 🐙 **GitHub Issues** and ✉️ **Gmail Dispatch**.
  - GitHub tab:
    - Target repository input (`owner/repo`) with local persistence.
    - Optional token input with toggle show/hide and local storage persistence.
    - Selectable action items checklist with "Select All" toggle.
    - "Create GitHub Issues" batch action button with progress indicator and status toast.
    - "Open in GitHub (No Token)" 1-click fallback button.
    - "Copy Issue Markdown" button.
  - Gmail tab:
    - Template selector: "Executive Brief" vs "Comprehensive Minutes".
    - Recipient attendees pill input with autocomplete from meeting speakers.
    - Live pre-rendered email body preview.
    - "Open in Gmail Web" button and "Open in Mail App (mailto:)" button.
- [ ] Add keyboard `Esc` listener and backdrop click to dismiss.

---

### Task 3: Zen / Executive Presentation Slide Deck Mode (`PresentationDeck.jsx`)

**Files:**
- Create: `meeting-assistant-ui/src/PresentationDeck.jsx`

- [ ] Implement `PresentationDeck.jsx` featuring:
  - Fullscreen immersive presentation layout (`fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-3xl`).
  - Dynamic slide generation from meeting outputs:
    - Slide 1: Executive Briefing & Key Metrics.
    - Slide 2: Governance & Key Decisions (Agent 5).
    - Slide 3: Delivery Blockers & Risk Matrix.
    - Slide 4: Action Items & Next Deliverables.
  - Controls:
    - Slide progress dots indicator with active glow.
    - Previous / Next buttons and keyboard `ArrowLeft` / `ArrowRight` navigation.
    - Autoplay toggle with timer progress indicator.
    - Top header with meeting title, current slide counter (`Slide 2 of 4`), and "Exit Zen Mode (Esc)" button.
  - Smooth slide transitions via Framer Motion spring physics.

---

### Task 4: View Transition Engine & Document Workspace Integration

**Files:**
- Modify: `meeting-assistant-ui/src/DocumentWorkspace.jsx`
- Modify: `meeting-assistant-ui/src/App.jsx`

- [ ] Add View Mode switcher to `DocumentWorkspace.jsx`:
  - 3 view modes: `studio` (Editor), `zen` (Presentation Deck), `split` (Split Inspector).
  - Apple Dynamic Glass pill controls in workspace header with `layoutId="active-view-mode"`.
- [ ] Add "Connect & Export" pill button to `DocumentWorkspace.jsx` triggering `ConnectorsModal`.
- [ ] Integrate `PresentationDeck.jsx` when in `zen` mode, preserving background audio session.
- [ ] Add interactive gesture enhancement to task items in `DocumentWorkspace.jsx` (smooth spring hover and check trigger).
- [ ] Pass necessary meeting data (`result`, `currentMeetingId`, `completedTasks`) into connectors modal.

---

### Task 5: Verification, Lint & Integration Commit

**Files:**
- All touched files

- [ ] Run full test suite: `node --test src/*.test.js` (ensure 100% tests pass).
- [ ] Run `npm run lint` (ensure 0 errors, 0 warnings).
- [ ] Run `npm run build` (ensure production build compiles cleanly in < 2s).
- [ ] Create dedicated branch `feat/lead-ui-connectors`, commit all changes, and push to origin.
