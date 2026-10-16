/**
 * Guided Product Tour & Interactive Feature Showcase Definition
 */

export const TOUR_STEPS = [
  {
    id: 'capture',
    badge: '01 · INGESTION & CAPTURE',
    title: 'Zero-Leak Audio Ingestion',
    headline: 'Capture meetings across Zoom, Meet, Teams, or local files.',
    description: 'Whether it is a live web conference or an uploaded audio file, ingest sound with 100% on-device privacy. Zero audio packets are uploaded to external clouds.',
    highlights: [
      'Universal platform recognition (Google Meet, Zoom, Teams, Webex, YouTube)',
      'High-throughput local Whisper streaming',
      'Hardware-accelerated on-premise execution'
    ],
    ctaText: 'Test Ingestion',
    mockVisual: {
      type: 'conference-grid',
      participants: [
        { name: 'Sarah Chen (PM)', avatar: 'SC', role: 'Host', isSpeaking: true },
        { name: 'Marcus Vance', avatar: 'MV', role: 'Backend Lead', isSpeaking: false },
        { name: 'Elena Rostova', avatar: 'ER', role: 'Architect', isSpeaking: false },
        { name: 'AI Meeting Bot', avatar: '🤖', role: 'Active Recorder', isSpeaking: false, isBot: true }
      ],
      soundwaveActive: true
    }
  },
  {
    id: 'transcript',
    badge: '02 · DIARIZATION & TRANSCRIPTION',
    title: 'Attributed Multi-Speaker Dialogue',
    headline: 'Crystal-clear speech-to-text with click-to-seek audio sync.',
    description: 'Advanced speaker clustering separates voice fingerprints into distinct dialogue turns. Click any sentence to instantly scrub audio playback directly to that timestamp.',
    highlights: [
      'Whisper Large-v3 with Vietnamese and English dual-mode',
      'Color-coded speaker identification avatars',
      'Millisecond-accurate audio seeking on every phrase'
    ],
    ctaText: 'Explore Transcript',
    mockVisual: {
      type: 'transcript-preview',
      turns: [
        { speaker: 'Sarah Chen', initial: 'SC', timestamp: '00:14', text: 'Let us confirm the Q4 deliverable deadlines before we sync with clients.' },
        { speaker: 'Marcus Vance', initial: 'MV', timestamp: '00:28', text: 'The WebSocket streaming and SQLite FTS search are ready for integration.' },
        { speaker: 'Elena Rostova', initial: 'ER', timestamp: '00:45', text: 'Approved. I will benchmark memory usage under high concurrent loads.' }
      ]
    }
  },
  {
    id: 'governance',
    badge: '03 · AI REASONING & GOVERNANCE',
    title: 'Automated Decisions & Risk Matrix',
    headline: 'Synthesize messy discussions into strict executive deliverables.',
    description: 'Our fine-tuned local LLM distills hours of unstructured dialogue into structured executive summaries, binding decisions, and tracked action items with assigned owners.',
    highlights: [
      '3-Pillar Governance: Decisions, Risks, and Open Questions',
      'Action items with assignees and explicit deadlines',
      'Traceable citations linking every conclusion to spoken proof'
    ],
    ctaText: 'View Insights',
    mockVisual: {
      type: 'governance-cards',
      decisions: ['Adopt WebSocket streaming for real-time tokens', 'Freeze feature additions on sprint 42'],
      tasks: [
        { text: 'Benchmark token usage under load', assignee: 'Elena', done: true },
        { text: 'Sync meeting minutes to leadership', assignee: 'Sarah', done: false }
      ]
    }
  },
  {
    id: 'connectors',
    badge: '04 · DISPATCH & AUTOMATION',
    title: 'Executive Connectors Hub',
    headline: 'Sync action items to GitHub and dispatch minutes via Gmail.',
    description: 'Bridge the gap between discussion and execution. Convert extracted tasks into GitHub Issues with one click and email beautifully structured minutes to all attendees.',
    highlights: [
      'GitHub Issues sync with zero-token browser fallback',
      'Executive Gmail Dispatch with attendee email resolution',
      'Multi-format export: Markdown, JSON, Text, and Zen Slide Deck'
    ],
    ctaText: 'Test Connectors',
    mockVisual: {
      type: 'connectors-hub',
      githubRepo: 'org/ai-meeting-assistant',
      issuesGenerated: 3,
      gmailRecipient: 'attendees@company.com'
    }
  }
];

/**
 * Computes next index with wrap-around
 * @param {number} currentIndex 
 * @param {number} [totalSteps] 
 * @returns {number}
 */
export function getNextStepIndex(currentIndex, totalSteps = TOUR_STEPS.length) {
  if (totalSteps <= 0) return 0;
  if (currentIndex < 0) return 0;
  return (currentIndex + 1) % totalSteps;
}

/**
 * Computes previous index with wrap-around
 * @param {number} currentIndex 
 * @param {number} [totalSteps] 
 * @returns {number}
 */
export function getPrevStepIndex(currentIndex, totalSteps = TOUR_STEPS.length) {
  if (totalSteps <= 0) return 0;
  return (currentIndex - 1 + totalSteps) % totalSteps;
}

/**
 * Retrieves a step by ID or defaults to first step
 * @param {string} stepId 
 * @returns {object}
 */
export function getStepById(stepId) {
  return TOUR_STEPS.find(s => s.id === stepId) || TOUR_STEPS[0];
}
