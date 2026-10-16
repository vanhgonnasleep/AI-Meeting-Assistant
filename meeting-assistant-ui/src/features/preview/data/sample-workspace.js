import { DEMO_SAMPLE } from '../../landing/demo-sample.js';

// Explicit, client-only fixtures. These are never copied from an account or saved to its library.
export const SAMPLE_MEETINGS = [
  {
    id: 'budget',
    title: DEMO_SAMPLE.title,
    project: 'Clarion Core Platform',
    duration: '00:29',
    kind: 'Recorded sample',
    summary: DEMO_SAMPLE.summary,
    transcript: DEMO_SAMPLE.turns
      .map((t) => `${t.speaker}: ${t.text}`)
      .join('\n'),
    audio: DEMO_SAMPLE.audio,
    decision: '$50,000 allocated to Q3 social campaigns.',
    color: 'lavender',
  },
  {
    id: 'design',
    title: 'A calmer recording experience',
    project: 'Clarion Core Platform',
    duration: 'Text fixture',
    kind: 'Illustrative sample',
    summary:
      'The team chose a simpler recording flow with a clear progress state and a review step before saving.',
    transcript:
      'Lan: Keep the recording controls visible on mobile. Minh: I will sketch a simpler layout. Lan: We will review it before implementation.',
    decision: 'Review the layout before implementation.',
    color: 'mint',
  },
  {
    id: 'compliance',
    title: 'A clear trail for every decision',
    project: 'Enterprise Compliance',
    duration: 'Text fixture',
    kind: 'Illustrative sample',
    summary:
      'Each action should link back to its source. The team will prepare a checklist for reviewing meeting evidence.',
    transcript:
      'An: Every task needs source evidence. Linh: I will prepare the review checklist. An: Good, keep the final approval with the reviewer.',
    decision: 'A reviewer approves the final evidence.',
    color: 'peach',
  },
];
export const SAMPLE_TASKS = [
  {
    id: 'financial',
    meeting: 'budget',
    task: DEMO_SAMPLE.task.text,
    owner: 'John',
    due: 'Friday afternoon',
    done: false,
  },
  {
    id: 'layout',
    meeting: 'design',
    task: 'Sketch the recording layout',
    owner: 'Minh',
    due: 'Not specified',
    done: false,
  },
  {
    id: 'checklist',
    meeting: 'compliance',
    task: 'Prepare the evidence checklist',
    owner: 'Linh',
    due: 'Not specified',
    done: false,
  },
];
