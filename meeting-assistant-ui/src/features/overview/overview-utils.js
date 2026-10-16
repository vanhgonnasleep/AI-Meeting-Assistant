import { formatMeetingDuration } from '../../app/navigation.js';

/**
 * Calculates overall task completion rate percentage (0 - 100)
 * @param {number|null} completed 
 * @param {number|null} pending 
 * @returns {number}
 */
export function calculateCompletionRate(completed, pending) {
  const c = Number(completed);
  const p = Number(pending);
  if (!Number.isFinite(c) || c <= 0) return 0;
  const safeP = Number.isFinite(p) && p > 0 ? p : 0;
  const total = c + safeP;
  if (total <= 0) return 0;
  return Math.round((c / total) * 100);
}

/**
 * Formats a raw meeting record into normalized card display fields
 * @param {object|null} meeting 
 * @returns {{ title: string, taskCount: number, language: string|null, durationText: string, dateText: string, summary: string }}
 */
export function formatMeetingPreview(meeting) {
  if (!meeting || typeof meeting !== 'object') {
    return {
      title: 'Untitled Meeting',
      taskCount: 0,
      language: null,
      durationText: 'Duration unavailable',
      dateText: 'Saved meeting',
      summary: 'No summary excerpt recorded.'
    };
  }

  const title = meeting.filename || meeting.title || 'Untitled Meeting';
  const taskCount = Number.isFinite(Number(meeting.action_item_count))
    ? Number(meeting.action_item_count)
    : (Array.isArray(meeting.action_items) ? meeting.action_items.length : 0);
  const language = meeting.language ? String(meeting.language).toUpperCase() : null;
  const durationText = formatMeetingDuration(meeting.duration) || 'Duration unavailable';
  const parsedDate = meeting.created_at ? new Date(meeting.created_at) : null;
  const dateText = (parsedDate && Number.isFinite(parsedDate.getTime()))
    ? parsedDate.toLocaleDateString()
    : 'Saved meeting';
  const summary = meeting.executive_summary || meeting.summary || 'No summary excerpt recorded.';

  return {
    title,
    taskCount,
    language,
    durationText,
    dateText,
    summary
  };
}

/**
 * Computes scroll delta for carousel left/right buttons
 * @param {'left'|'right'} direction 
 * @param {number} [cardWidth=340] 
 * @returns {number}
 */
export function getCarouselScrollOffset(direction, cardWidth = 340) {
  if (direction === 'left') return -cardWidth;
  if (direction === 'right') return cardWidth;
  return 0;
}
