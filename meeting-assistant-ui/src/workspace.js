const objects = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
const text = value => String(value ?? '');

export function createMutationLock() {
  let active = null;
  return {
    tryAcquire() {
      if (active) return null;
      const token = {};
      active = token;
      return () => { if (active === token) active = null; };
    },
    isLocked: () => active !== null,
    reset() { active = null; },
  };
}

export function createMeetingDraft(meeting) {
  const insights = meeting.insights && typeof meeting.insights === 'object' && !Array.isArray(meeting.insights) ? meeting.insights : {};
  return structuredClone({
    raw_transcript: text(meeting.raw_transcript),
    executive_summary: text(meeting.executive_summary),
    segments: objects(meeting.segments).map(segment => ({ ...segment, text: text(segment.text) })),
    action_items: (Array.isArray(meeting.action_items) ? meeting.action_items : []).map(item => {
      const task = item && typeof item === 'object' && !Array.isArray(item) ? item : { task: text(item) };
      return { ...task, task: text(task.task), assignee: text(task.assignee), deadline: text(task.deadline), status: task.status || 'pending' };
    }),
    insights: { ...insights, ...Object.fromEntries(['decisions', 'risks', 'open_questions'].map(key => [key,
      objects(insights[key]).map(item => ({ ...item, text: text(item.text), ...(key === 'decisions' ? { status: item.status || 'proposed' } : {}) }))])) },
  });
}

export function buildReviewPayload(meeting, draft) {
  const original = createMeetingDraft(meeting);
  const payload = { expected_revision: meeting.revision || 0, review_status: 'draft' };
  for (const key of ['executive_summary', 'action_items', 'insights']) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(original[key])) payload[key] = draft[key];
  }
  if (original.segments.length) {
    if (JSON.stringify(draft.segments) !== JSON.stringify(original.segments)) payload.segments = draft.segments;
  } else if (draft.raw_transcript !== original.raw_transcript) payload.raw_transcript = draft.raw_transcript;
  return payload;
}

export function buildReviewStatusPayload(meeting) {
  return { expected_revision: meeting.revision || 0, review_status: 'reviewed' };
}

export function applyEditorResponse(state, response) {
  if (response.error) return { ...state, busy: false, error: response.error.message, conflict: response.error.status === 409 };
  return { meeting: response.meeting, draft: createMeetingDraft(response.meeting), busy: false, error: null, conflict: false };
}

export function buildTaskQuery(filters, offset = 0) {
  const params = new URLSearchParams({ limit: '50', offset: String(offset) });
  for (const key of ['q', 'status', 'assignee', 'project_id']) {
    if (filters[key] !== '' && filters[key] != null) params.set(key, String(filters[key]));
  }
  return params.toString();
}

export async function workspaceRequest(url, options = {}) {
  const response = await fetch(url, { ...options,
    ...(options.body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail)
      ? data.detail.map(item => item.msg || 'Invalid value').join('; ') : `Request failed (HTTP ${response.status}). Please retry.`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return data;
}
