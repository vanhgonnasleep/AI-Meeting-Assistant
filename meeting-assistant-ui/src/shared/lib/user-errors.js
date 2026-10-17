/** User-facing recovery copy. Server text is classified here, never displayed. */
export class UserFacingError extends Error {
  constructor(message, { status, code = 'unavailable' } = {}) {
    super(message);
    this.name = 'UserFacingError';
    this.status = status;
    this.code = code;
  }
}

const recovery = {
  load: 'We couldn’t load your meetings. Try again in a moment.',
  open: 'We couldn’t open this meeting. Return to your library and try again.',
  projects: 'We couldn’t load your projects. Try again in a moment.',
  tasks: 'We couldn’t load your action items. Try again in a moment.',
  createProject: 'We couldn’t confirm whether your project was created. Check your project list before trying again.',
  save: 'We couldn’t confirm whether your changes were saved. Keep this page open and check your library before trying again.',
  delete: 'We couldn’t confirm whether this meeting was deleted. Refresh your library before trying again.',
  process: 'We couldn’t confirm whether your recording finished processing. Keep your recording and check your library before starting again.',
  chat: 'We couldn’t finish the answer. Ask again in a moment and check important details against the transcript.',
  clearChat: 'We couldn’t confirm whether the conversation was cleared. Reopen this meeting to check before clearing it again.',
  session: 'We couldn’t check your sign-in. Try again in a moment, or explore the sample workspace.',
  logout: 'We couldn’t confirm sign-out. Try signing out again before leaving a shared device.',
  recording: 'We couldn’t record your audio. Check your microphone and try again, or upload a recording.',
  sample: 'We couldn’t open the sample recording. Try again, or upload a recording of your own.',
  github: 'We couldn’t confirm whether the GitHub issue was created. Check your repository before trying again.',
};

export function requestContext(input, options = {}) {
  const path = new URL(input, 'http://local.invalid').pathname;
  const method = (options.method || 'GET').toUpperCase();
  let operation = 'load';
  if (path.includes('/auth/session')) operation = 'session';
  else if (path.includes('/auth/logout')) operation = 'logout';
  else if (path.includes('/chat')) operation = method === 'DELETE' ? 'clearChat' : 'chat';
  else if (/process-audio|transcribe/.test(path)) operation = 'process';
  else if (method === 'DELETE') operation = 'delete';
  else if (path.startsWith('/api/projects')) operation = method === 'POST' && path === '/api/projects' ? 'createProject' : 'projects';
  else if (path === '/api/tasks') operation = 'tasks';
  else if (method !== 'GET' && method !== 'HEAD') operation = 'save';
  else if (/\/meetings\/\d+$/.test(path)) operation = 'open';
  return { operation };
}

export function networkFailure({ operation = 'load', offline = globalThis.navigator?.onLine === false } = {}) {
  const actions = { load: 'load your meetings', open: 'open this meeting', projects: 'load your projects',
    tasks: 'load your action items', chat: 'finish your answer', session: 'check your sign-in', sample: 'open the sample recording' };
  const connection = offline ? 'Your device appears to be offline. Reconnect and try again.'
    : `We couldn’t reach Clarion to ${actions[operation] || actions.load}. Check your connection and try again.`;
  const needsConfirmation = ['save', 'delete', 'createProject', 'process', 'github', 'logout', 'clearChat'].includes(operation);
  return new UserFacingError(needsConfirmation ? `${recovery[operation]} ${offline ? 'Your device appears to be offline.' : 'The connection was interrupted.'}`
    : `${connection}${operation === 'session' ? ' You can still explore the sample workspace.' : ''}`, { code: offline ? 'offline' : 'connection' });
}

const fieldNames = {
  filename: 'meeting name', raw_transcript: 'transcript', executive_summary: 'summary',
  question: 'question', deadline_iso: 'due date', deadline: 'due date', task: 'task',
  assignee: 'task owner', status: 'task status', name: 'project name',
  old_name: 'speaker name', new_name: 'speaker name', file: 'recording',
  segments: 'transcript sections', action_items: 'action items', language: 'language',
  duration: 'recording length', project_id: 'project', model: 'selected AI option',
};

export function responseFailure(status, data = {}, { operation = 'load' } = {}) {
  const detail = typeof data?.detail === 'string' ? data.detail.slice(0, 2000) : '';
  let message = recovery[operation] || recovery.load;
  if (status === 401) message = 'Your sign-in has expired. Sign in again to open your private workspace.';
  else if (status === 403) message = 'We couldn’t confirm permission for this action. Keep a copy of any edits, then sign in again.';
  else if (status === 404) message = operation === 'projects' || operation === 'createProject'
    ? 'This project is no longer available. Refresh your project list and choose another project.'
    : 'This meeting is no longer available in your library. Refresh your library and choose another meeting.';
  else if (status === 409) message = operation === 'createProject'
    ? 'A project with this name already exists. Choose it from the list or enter a different name.'
    : 'This meeting changed elsewhere. Keep a copy of your edits, then reopen the latest version from your library.';
  else if (status === 413) message = /duration|seconds|too long/i.test(detail)
    ? 'This recording is too long to process. Split it into shorter recordings and try again.'
    : 'This file is too large to upload. Choose a smaller file or split the recording into shorter parts.';
  else if (status === 422) {
    const fields = Array.isArray(data?.detail) ? [...new Set(data.detail.flatMap(item =>
      Array.isArray(item?.loc) ? item.loc.map(key => fieldNames[key]).filter(Boolean) : []))].slice(0, 3) : [];
    message = fields.length ? `Please check the ${fields.join(', ')} and try again.`
      : 'Some details need attention. Check your entries and try again.';
  } else if (status === 429) message = 'Clarion is handling several requests. Wait a moment, then try again.';
  else if (status === 503 && /another transcription|already.*running|busy/i.test(detail)) {
    message = 'Another recording is being processed. Wait for it to finish, then try again.';
  } else if (status === 400 && /audio|ffmpeg|format|decode|recording|empty file/i.test(detail)) {
    message = 'We couldn’t read this recording. Try a WAV or MP3 file, or record it again.';
  } else if (status === 400 && /question/i.test(detail)) {
    message = 'Enter a question about this meeting and try again.';
  } else if (status === 503 && operation === 'process') {
    message = /whisper|transcrib|speech|ffmpeg/i.test(detail)
      ? 'We can’t transcribe recordings right now. Keep your file and try again later.'
      : 'We can’t prepare meeting notes right now. Keep your recording and try again later.';
  }
  return new UserFacingError(message, { status, code: status === 409 ? 'conflict' : 'request' });
}

export function userMessage(error, operation = 'load') {
  if (error instanceof UserFacingError) return error.message;
  // Only the fetch boundary can establish a connection failure. Other native
  // TypeErrors may be programming errors and must not be mislabeled as offline.
  return recovery[operation] || recovery.load;
}

export function microphoneMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Microphone access is blocked. Allow microphone access in your browser, or upload a recording instead.';
  }
  if (error?.name === 'NotFoundError') return 'No microphone was found. Connect a microphone, or upload a recording instead.';
  if (error?.name === 'NotReadableError') return 'Your microphone is unavailable. Close other apps using it, then try again.';
  return recovery.recording;
}

export function warningMessage(warning) {
  if (/audio needs review|language detection/i.test(String(warning))) {
    return /language detection/i.test(String(warning))
      ? 'The spoken language may have been detected incorrectly. Choose the language and process again if the words look wrong.'
      : 'Some audio needs review. Check the highlighted passages before using or sharing the meeting notes.';
  }
  if (/could not be saved|not.*saved|save.*failed/i.test(String(warning))) {
    return 'Your meeting notes are ready, but saving wasn’t confirmed. Export your notes before leaving this page.';
  }
  if (/summary.*unavailable|summari.*failed/i.test(String(warning))) {
    return 'The summary is incomplete. Review the transcript before sharing these notes.';
  }
  if (/heuristic|action.*fallback/i.test(String(warning))) {
    return 'Some action items were identified using a simpler method. Review their owners and due dates.';
  }
  return 'Some meeting notes may be incomplete. Review the transcript before sharing.';
}
