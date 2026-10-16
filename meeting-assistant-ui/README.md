# 💻 Meeting Assistant Web Client

> Modern, responsive web dashboard for the **AI Meeting Assistant** platform, built with React 19, Vite, and Tailwind CSS.

---

## 🌟 Key Features

- **Private accounts:** Google/GitHub sign-in, separate libraries, session expiry/logout and account-safe requests. Provider credentials are configured on the backend; see [sign-in setup](../docs/auth-setup.md).
- **Drag-and-Drop Ingestion:** Audio and video file drops with format validation (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.mp4`, `.webm`, `.mkv`) and size bounds.
- **Adaptive Model Selection:** Dynamic profile switcher between Auto-detection, Llama 3 (8B GPU), Llama 3.2 (3B / 1B CPU), and Instant Demo mode.
- **Algorithmic MMR Telemetry:** Live visualization of noise reduction percentage, sentence counts, word savings, and trade-off parameter $\lambda$.
- **Dual Transcript Switcher:** Toggle smoothly between Raw Whisper transcription and MMR-filtered sentences.
- **Interactive Action Item Checklist:** Check off extracted deliverables in real time with assignee tagging.
- **Markdown Export & Clipboard Sync:** One-click copy or `.md` file download containing formatted executive summaries and task breakdowns.
- **SQLite History Drawer:** Modal dialog to view, inspect, reload, or delete past meeting records persisted locally.
- **Defensive Inline Error States:** In-context error and offline engine status banners with actionable resolution commands.

---

## 🛠️ Development & Build

### Prerequisites
- Node.js 24 LTS recommended (Vite 8 minimum: 20.19+ or 22.12+)
- npm or yarn

### Quick Start
```bash
# Install dependencies
npm install

# Start development server (Port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📦 Tech Stack

- **Framework:** React 19
- **Bundler & Dev Server:** Vite 8
- **Styling:** Tailwind CSS 4 with the official Vite plugin
- **Icons:** Lucide React
- **File Handling:** react-dropzone

## Source map

- `src/main.jsx` mounts the application and loads global styles.
- `src/app/` owns the application, sidebar, navigation and shell.
- `src/features/` groups meetings, chat, recording/upload, workspace, overview, landing/demo and connectors. Behavior tests live beside their feature modules.
- `src/shared/ui/`, `src/shared/hooks/`, `src/shared/lib/` and `src/shared/assets/` hold reusable building blocks, including the asynchronous request gate.
- `src/styles/` contains the global design, with the existing RGB palette retained in `legacy-colors.js` and loaded through `tailwind.config.js`.
- `scripts/test.mjs` discovers feature tests recursively and includes the repository's database-command tests. Run `npm test`, `npm run lint`, `npm run build` and `npm audit` before integration.

Tailwind 4 targets Safari 16.4+, Chrome 111+ and Firefox 128+. Utility names and base control styles follow the [official upgrade guide](https://tailwindcss.com/docs/upgrade-guide) while retaining the existing interface.
