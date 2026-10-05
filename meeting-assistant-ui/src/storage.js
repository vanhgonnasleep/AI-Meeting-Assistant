import { getExportTasks, normalizeChatMessages } from './session.js';

export function buildMeetingSavePayload({ saveKey, filename, result, completedTasks = {}, chatMessages = [], isDemo = false }) {
  if (isDemo) throw new Error('Demo meetings cannot be saved to the real library.');
  if (!result) throw new Error('Process a meeting before saving it.');
  const tasks = (result.action_items || []).map(item => typeof item === 'string' ? { task: item, status: 'pending' } : item);
  return { save_key: saveKey, filename: filename || 'Meeting recording',
    raw_transcript: result.transcript || '', executive_summary: result.summary || '',
    duration: result.duration ?? null, language: result.language || null,
    segments: result.segments || [], insights: result.insights || {},
    action_items: getExportTasks(tasks, completedTasks).map(item => ({ task: item.task,
      assignee: item.assignee || 'Unassigned', deadline: item.deadline || null, status: item.status })),
    chat_history: normalizeChatMessages(chatMessages).slice(-200) };
}
