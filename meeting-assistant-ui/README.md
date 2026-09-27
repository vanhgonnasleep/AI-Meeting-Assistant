# 💻 Meeting Assistant Web Client

> Modern, responsive web dashboard for the **AI Meeting Assistant** platform, built with React 19, Vite, and Tailwind CSS.

---

## 🌟 Key Features

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
- Node.js 18+ (tested on Node 20+)
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
- **Styling:** Tailwind CSS 3
- **Icons:** Lucide React
- **File Handling:** react-dropzone
