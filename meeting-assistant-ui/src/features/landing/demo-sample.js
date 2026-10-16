// Precomputed outputs for the bundled 29-second recording; no inference is simulated as live.
export const DEMO_SAMPLE = {
  title: 'Q3 budget review',
  audio: '/q3_product_budget_review.mp3',
  duration: 29.05,
  summary: 'The team agreed on a $50,000 Q3 social media budget. John will prepare the financial breakdown by Friday afternoon.',
  task: { text: 'Prepare the detailed financial report', assignee: 'John', due: 'Friday afternoon' },
  turns: [
    { start: 0, end: 12, speaker: 'Speaker A', initial: 'A', text: 'I propose an allocation of $50,000 for targeted social media ad campaigns.', accent: 'lavender' },
    { start: 12, end: 23, speaker: 'Speaker B', initial: 'B', text: "Let’s lock it in. Can you prepare the detailed financial report by Friday, John?", accent: 'mint' },
    { start: 23, end: 29.05, speaker: 'Speaker A', initial: 'A', text: 'I’ll have the complete breakdown ready by Friday afternoon.', accent: 'lavender' },
  ],
};

export function sampleTurnAt(seconds) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return time >= 23 ? 2 : time >= 12 ? 1 : 0;
}
