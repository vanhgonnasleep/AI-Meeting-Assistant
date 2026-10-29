import { DEMO_SAMPLE } from '../../landing/demo-sample.js';

// Explicit, client-only fixtures. These are never copied from an account or saved to its library.
export const SAMPLE_MEETINGS = [
  {
    id: 'budget',
    title: DEMO_SAMPLE.title, // 'Q3 budget review'
    project: 'Clarion Core Platform',
    duration: '00:29',
    raw_duration: 29.05,
    kind: 'Recorded sample',
    summary: [
      'Agreed on $50,000 budget allocation for targeted Q3 social media ad campaigns.',
      'John will prepare the detailed financial breakdown and report by Friday afternoon.',
    ],
    summary_text: DEMO_SAMPLE.summary,
    transcript: DEMO_SAMPLE.turns
      .map((t) => `${t.speaker}: ${t.text}`)
      .join('\n'),
    audio: DEMO_SAMPLE.audio,
    decision: '$50,000 allocated to Q3 social campaigns.',
    decisions: [
      {
        id: 'dec-1',
        text: 'Approved $50,000 allocation for targeted social media advertising in Q3.',
        confidence: 0.96,
        source_segment: 0,
      },
    ],
    action_items: [
      {
        id: 'task-1',
        task: 'Prepare the detailed financial report',
        assignee: 'John',
        due_date: 'Friday afternoon',
        status: 'pending',
        confidence: 0.94,
        source_segment: 1,
      },
      {
        id: 'task-2',
        task: 'Finalize audience criteria for social ad channels',
        assignee: 'Marketing Team',
        due_date: 'Next Tuesday',
        status: 'done',
        confidence: 0.91,
        source_segment: 0,
      },
    ],
    questions: [
      {
        id: 'q-1',
        text: 'Can you prepare the detailed financial report by Friday, John?',
        asker: 'Speaker B',
        answered: true,
        source_segment: 1,
      },
    ],
    risks: [
      {
        id: 'risk-1',
        text: 'Financial breakdown model delivery prior to campaign rollout.',
        severity: 'medium',
        source_segment: 2,
      },
    ],
    speaker_profiles: [
      {
        name: 'Speaker A (Marketing Lead)',
        voiceprint_id: 'vp_a108',
        confidence: 0.96,
        sample_count: 2,
      },
      {
        name: 'Speaker B (John - Finance)',
        voiceprint_id: 'vp_b204',
        confidence: 0.92,
        sample_count: 1,
      },
    ],
    turns: DEMO_SAMPLE.turns,
    color: 'lavender',
    date: 'Today, 10:30 AM',
    language: 'en',
  },
  {
    id: 'design',
    title: 'A calmer recording experience',
    project: 'Clarion Core Platform',
    duration: '01:15',
    raw_duration: 75.0,
    kind: 'Illustrative sample',
    summary: [
      'The team chose a simpler recording flow with a clear progress state and a review step before saving.',
      'Minh will sketch the updated layout before final implementation.',
    ],
    summary_text:
      'The team chose a simpler recording flow with a clear progress state and a review step before saving.',
    transcript:
      'Lan: Keep the recording controls visible on mobile.\nMinh: I will sketch a simpler layout.\nLan: We will review it before implementation.',
    decision: 'Review the layout before implementation.',
    decisions: [
      {
        id: 'dec-2',
        text: 'Require collaborative team review of the mobile recording layout prior to code rollout.',
        confidence: 0.95,
        source_segment: 2,
      },
    ],
    action_items: [
      {
        id: 'task-3',
        task: 'Sketch the recording layout with visible mobile controls',
        assignee: 'Minh',
        due_date: 'Tomorrow, 5:00 PM',
        status: 'pending',
        confidence: 0.93,
        source_segment: 1,
      },
    ],
    questions: [],
    risks: [],
    speaker_profiles: [
      {
        name: 'Lan (Design Lead)',
        voiceprint_id: 'vp_l101',
        confidence: 0.94,
        sample_count: 2,
      },
      {
        name: 'Minh (Frontend Dev)',
        voiceprint_id: 'vp_m202',
        confidence: 0.91,
        sample_count: 1,
      },
    ],
    turns: [
      {
        start: 0,
        end: 24,
        speaker: 'Lan',
        initial: 'L',
        text: 'Keep the recording controls visible on mobile screens at all times.',
        accent: 'mint',
      },
      {
        start: 24,
        end: 50,
        speaker: 'Minh',
        initial: 'M',
        text: 'I will sketch a simpler, distraction-free layout by tomorrow.',
        accent: 'lavender',
      },
      {
        start: 50,
        end: 75,
        speaker: 'Lan',
        initial: 'L',
        text: 'We will review it together before proceeding with implementation.',
        accent: 'mint',
      },
    ],
    color: 'mint',
    date: 'Yesterday, 3:15 PM',
    language: 'en',
  },
  {
    id: 'compliance',
    title: 'A clear trail for every decision',
    project: 'Enterprise Compliance',
    duration: '02:00',
    raw_duration: 120.0,
    kind: 'Illustrative sample',
    summary: [
      'Each action should link back to its source. The team will prepare a checklist for reviewing meeting evidence.',
      'Linh will draft the evidence verification checklist for compliance sign-off.',
    ],
    summary_text:
      'Each action should link back to its source. The team will prepare a checklist for reviewing meeting evidence.',
    transcript:
      'An: Every task needs source evidence.\nLinh: I will prepare the review checklist.\nAn: Good, keep the final approval with the reviewer.',
    decision: 'A reviewer approves the final evidence.',
    decisions: [
      {
        id: 'dec-3',
        text: 'Mandate reviewer sign-off on all audit evidence before report export.',
        confidence: 0.98,
        source_segment: 2,
      },
    ],
    action_items: [
      {
        id: 'task-4',
        task: 'Prepare the evidence checklist for decision verification',
        assignee: 'Linh',
        due_date: 'Next Monday',
        status: 'pending',
        confidence: 0.95,
        source_segment: 1,
      },
    ],
    questions: [],
    risks: [],
    speaker_profiles: [
      {
        name: 'An (Security Officer)',
        voiceprint_id: 'vp_a303',
        confidence: 0.97,
        sample_count: 2,
      },
      {
        name: 'Linh (Compliance QA)',
        voiceprint_id: 'vp_l404',
        confidence: 0.92,
        sample_count: 1,
      },
    ],
    turns: [
      {
        start: 0,
        end: 38,
        speaker: 'An',
        initial: 'A',
        text: 'Every task needs auditable source evidence linked to the transcript.',
        accent: 'peach',
      },
      {
        start: 38,
        end: 82,
        speaker: 'Linh',
        initial: 'L',
        text: 'I will prepare the comprehensive review checklist for team sign-off.',
        accent: 'lavender',
      },
      {
        start: 82,
        end: 120,
        speaker: 'An',
        initial: 'A',
        text: 'Good, keep the final approval strictly with the designated reviewer.',
        accent: 'peach',
      },
    ],
    color: 'peach',
    date: 'Oct 24, 2026',
    language: 'en',
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
    project: 'Clarion Core Platform',
  },
  {
    id: 'layout',
    meeting: 'design',
    task: 'Sketch the recording layout',
    owner: 'Minh',
    due: 'Tomorrow, 5:00 PM',
    done: false,
    project: 'Clarion Core Platform',
  },
  {
    id: 'checklist',
    meeting: 'compliance',
    task: 'Prepare the evidence checklist',
    owner: 'Linh',
    due: 'Next Monday',
    done: false,
    project: 'Enterprise Compliance',
  },
];
