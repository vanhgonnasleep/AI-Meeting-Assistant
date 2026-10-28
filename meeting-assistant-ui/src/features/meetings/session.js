export function normalizeCitation(citation) {
  let label = typeof citation === 'string' ? citation : String(citation?.timestamp || 'Transcript excerpt');
  if (citation && typeof citation === 'object' && citation.meeting_title) {
    label = `${citation.meeting_title} · ${label}`;
  }
  if (citation && typeof citation === 'object') {
    return { label, seconds: Number.isFinite(citation.start) && citation.start >= 0 ? citation.start : null };
  }
  const match = label.match(/(?<![\d:-])(\d{1,3}:\d{2}(?::\d{2})?)(?![\d:])/);
  if (!match) return { label, seconds: null };
  const parts = match[1].split(':').map(Number);
  if (parts.slice(1).some(part => part >= 60)) return { label, seconds: null };
  return { label, seconds: parts.reduce((total, part) => total * 60 + part, 0) };
}

export { createRequestGate } from '../../shared/lib/request-gate.js';

// Topics come from the current source text, not unverified generated summaries/tasks.
const TOPIC_ORDER = ['decision', 'follow-up', 'risk', 'question', 'topic'];
const VIETNAMESE_TEXT = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/iu;
const TOPIC_LABELS = {
  en: { decision: 'Decision', 'follow-up': 'Follow-up', risk: 'Risk', question: 'Open question', topic: 'Topic' },
  vi: { decision: 'Quyết định', 'follow-up': 'Việc tiếp theo', risk: 'Rủi ro', question: 'Câu hỏi mở', topic: 'Chủ đề' },
};
const normalizeQuestion = text => String(text || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const shortText = (text, max) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return (cut.replace(/\s+\S*$/u, '') || cut) + '…';
};
const isVietnamese = (result, text) => result?.language === 'vi' || VIETNAMESE_TEXT.test(text);

function collectTopics(result) {
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  let texts = segments.filter(segment => !needsSpeechReview(segment)).map(segment => typeof segment?.text === 'string' ? segment.text : '').filter(text => text.trim());
  const fromSegments = texts.length > 0;
  if (!texts.length && !segments.some(needsSpeechReview) && typeof result?.transcript === 'string') texts = [result.transcript];
  const seen = new Set();
  const candidates = [];
  for (const text of texts) {
    for (const part of text.split(/(?<=[.!?])\s+|\n+/u)) {
      let cleaned = part.trim();
      if (!fromSegments) {
        const timestamp = /^\[\d{1,3}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,3}:\d{2}(?::\d{2})?)?\]\s*/u;
        const attributed = timestamp.test(cleaned);
        cleaned = cleaned.replace(timestamp, '');
        // Segment.text is spoken text; only raw transcript attribution has headers.
        cleaned = cleaned.replace(attributed ? /^[\p{L}][\p{L}\p{M}\p{N} .'-]{0,60}:\s+/u : /^Speaker\s+[\p{L}\p{N}]+:\s*/iu, '');
      }
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      if (cleaned.length < 8 || /^(?:hello(?: everyone)?|hi(?: everyone)?|welcome(?: everyone)?|thank you|thanks|okay|xin chào|cảm ơn)[.!]*$/iu.test(cleaned)) continue;
      const shortened = cleaned.length > 150 ? cleaned.slice(0, 147).replace(/\s+\S*$/u, '') + '…' : cleaned;
      const key = shortened.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const category = /\b(?:agreed|decided|approved|confirmed|thống nhất|quyết định|chốt)\b/iu.test(cleaned) ? 'decision'
        : /\b(?:risk|blocker|delay|concern|rủi ro|trở ngại|chậm tiến độ)\b/iu.test(cleaned) ? 'risk'
        : /\b(?:will|must|needs to|deadline|sẽ|cần|hạn chót)\b/iu.test(cleaned) ? 'follow-up'
        : cleaned.includes('?') ? 'question' : 'topic';
      candidates.push({ excerpt: shortened, category });
    }
  }
  return candidates;
}

// Prefer distinct categories before filling with other transcript excerpts.
function selectTopics(candidates, limit, skip = () => false) {
  const pool = candidates.filter(candidate => !skip(candidate));
  const selected = [];
  for (const category of TOPIC_ORDER) {
    const candidate = pool.find(item => item.category === category);
    if (candidate && selected.length < limit) selected.push(candidate);
  }
  for (const candidate of pool) {
    if (selected.length >= limit) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected;
}

function topicItem({ excerpt, category }, result) {
  const vi = isVietnamese(result, excerpt);
  const label = `${TOPIC_LABELS[vi ? 'vi' : 'en'][category]}: ${shortText(excerpt, 30)}`;
  if (vi) {
    if (category === 'decision') return { category, label, question: `Cuộc họp đã quyết định gì về “${excerpt}”?` };
    if (category === 'follow-up') return { category, label, question: `Việc cần làm tiếp theo liên quan đến “${excerpt}” là gì?` };
    if (category === 'risk') return { category, label, question: `Cuộc họp nói gì về rủi ro trong “${excerpt}”?` };
    return { category, label, question: `Cuộc họp nói gì về “${excerpt}”?` };
  }
  if (category === 'decision') return { category, label, question: `What decision, if any, is discussed in “${excerpt}”?` };
  if (category === 'follow-up') return { category, label, question: `What follow-up, if any, is discussed in “${excerpt}”?` };
  if (category === 'risk') return { category, label, question: `What does the meeting say about the concern in “${excerpt}”?` };
  return { category, label, question: `What does the meeting say about “${excerpt}”?` };
}

/** Starter questions: a short chip label plus the full, transcript-grounded question that is sent. */
export function getSuggestionItems(result, limit = 4) {
  return selectTopics(collectTopics(result), limit).map(topic => topicItem(topic, result));
}

export function getSuggestedPrompts(result) {
  return getSuggestionItems(result).map(item => item.question);
}

// Questions are self-contained because chat requests do not carry conversation history.
function citedPassageItem(text, index, result) {
  const excerpt = shortText(text, 90);
  const vi = isVietnamese(result, text);
  if (index === 0) {
    return vi
      ? { category: 'owner', label: `Người phụ trách: ${shortText(text, 28)}`, question: `Ai phụ trách “${excerpt}” và hạn chót là khi nào?` }
      : { category: 'owner', label: `Owner & deadline: ${shortText(text, 26)}`, question: `Who is responsible for “${excerpt}”, and by when?` };
  }
  return vi
    ? { category: 'context', label: `Thêm bối cảnh: ${shortText(text, 30)}`, question: `Cuộc họp còn nói gì thêm về “${excerpt}”?` }
    : { category: 'context', label: `More context: ${shortText(text, 30)}`, question: `What else does the meeting say about “${excerpt}”?` };
}

/**
 * Related questions shown under the latest answer: first grounded in the passages it cited,
 * then filled with transcript topics that have not been asked yet. Never repeats a question.
 */
export function getFollowUpPrompts({ result, chatMessages = [], limit = 3 } = {}) {
  const messages = Array.isArray(chatMessages) ? chatMessages : [];
  const latest = [...messages].reverse().find(message => message?.role === 'assistant' && !message.streaming);
  if (!result || !latest) return [];
  const asked = messages.filter(message => message?.role === 'user').map(message => normalizeQuestion(message.content));
  const blocked = new Set(asked);
  const items = [];
  const push = item => {
    const key = normalizeQuestion(item.question);
    if (blocked.has(key) || items.length >= limit) return;
    blocked.add(key);
    items.push(item);
  };
  const cited = (Array.isArray(latest.citations) ? latest.citations : [])
    .map(citation => typeof citation?.text === 'string' ? citation.text.replace(/\s+/g, ' ').trim() : '')
    .filter((text, index, all) => text.length >= 8 && all.indexOf(text) === index);
  const wasAsked = text => asked.some(question => question.includes(normalizeQuestion(text)));
  cited.filter(text => !wasAsked(shortText(text, 90))).slice(0, 2)
    .forEach((text, index) => push(citedPassageItem(text, index, result)));
  const coveredByCitation = excerpt => cited.some(text => normalizeQuestion(text).includes(normalizeQuestion(excerpt)));
  for (const topic of selectTopics(collectTopics(result), limit + 4, topic => wasAsked(topic.excerpt) || coveredByCitation(topic.excerpt))) {
    push(topicItem(topic, result));
  }
  return items;
}


export function buildChatPayload({ question, meetingId, model, isDemo, result, semantic = false, embeddingModel = 'embeddinggemma' }) {
  const retrieval = { semantic: Boolean(semantic), ...(semantic ? { embedding_model: embeddingModel.trim() || 'embeddinggemma' } : {}) };
  if (meetingId) return { question, model, meeting_id: meetingId, ...retrieval };
  return { question, model, ...retrieval, demo_mode: Boolean(isDemo), transcript: result?.transcript || '',
    summary: result?.summary || '', segments: result?.segments || null, language: result?.language || 'en' };
}

export function resultFromMeeting(meeting) {
  const objects = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
  const text = value => String(value ?? '');
  const insights = meeting.insights && typeof meeting.insights === 'object' && !Array.isArray(meeting.insights) ? meeting.insights : {};
  const segments = (Array.isArray(meeting.segments) ? meeting.segments : [])
    .filter(segment => segment && typeof segment === 'object').map(segment => ({ ...segment, text: String(segment.text ?? '') }));
  return {
    revision: meeting.revision || 0, review_status: meeting.review_status || 'draft', project_id: meeting.project_id ?? null,
    transcript: segments.some(needsSpeechReview) ? speechTranscript(segments) : text(meeting.raw_transcript), summary: text(meeting.executive_summary),
    action_items: Array.isArray(meeting.action_items) ? meeting.action_items.map(item => item && typeof item === 'object' && !Array.isArray(item)
      ? { ...item, task: text(item.task), assignee: text(item.assignee), deadline: text(item.deadline) } : { task: text(item), status: 'pending' }) : [],
    insights: { ...insights, ...Object.fromEntries(['decisions', 'risks', 'open_questions'].map(key => [key, objects(insights[key]).map(item => ({ ...item, text: text(item.text) }))])) },
    chat_history: normalizeChatMessages(meeting.chat_history), duration: meeting.duration, language: meeting.language,
    segments,
    speakers: [...new Set(segments.map(segment => segment.speaker).filter(Boolean))],
  };
}

export function getExportTasks(items, completedTasks) {
  return items.map((item, index) => ({ ...item, status: completedTasks[index] ? 'completed'
    : Object.hasOwn(completedTasks, index) && ['completed', 'done'].includes(item.status) ? 'pending' : item.status || 'pending' }));
}

export function shouldSubmitChat(event) {
  return event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing;
}

export function normalizeChatMessages(messages) {
  return (Array.isArray(messages) ? messages : []).filter(message => message && typeof message === 'object' && !Array.isArray(message))
    .map(message => ({ ...message, content: String(message.content ?? ''),
      citations: (Array.isArray(message.citations) ? message.citations : []).filter(citation =>
        typeof citation === 'string' || (citation && typeof citation === 'object' && !Array.isArray(citation))) }));
}

export function editSpeakerAttribution(result, oldName, newName, segmentIndex = null) {
  const affected = (result.segments || []).filter((segment, index) => segment.speaker === oldName && (segmentIndex === null || index === segmentIndex));
  const starts = new Set(affected.map(segment => segment.start));
  const evidence = item => item && typeof item === 'object' && item.speaker === oldName &&
    (segmentIndex === null || (item.start != null && starts.has(item.start))) ? { ...item, speaker: newName } : item;
  const segments = (result.segments || []).map((segment, index) =>
    segment.speaker === oldName && (segmentIndex === null || index === segmentIndex) ? { ...segment, speaker: newName } : segment);
  return { ...result, segments, speakers: [...new Set(segments.map(segment => segment.speaker).filter(Boolean))],
    transcript: speechTranscript(segments),
    insights: Object.fromEntries(Object.entries(result.insights || {}).map(([key, items]) => [key, Array.isArray(items) ? items.map(evidence) : items])),
    chat_history: (result.chat_history || []).map(message => ({ ...message, citations: (message.citations || []).map(evidence) })),
  };
}

export const needsSpeechReview = segment => segment?.quality?.status === 'needs_review';
export const speechDisplayText = segment => needsSpeechReview(segment) ? '[Unclear speech - review audio]' : String(segment?.text || '');
export const speechTranscript = segments => segments.filter(segment => speechDisplayText(segment).trim())
  .map(segment => `${segment.timestamp || ''} ${segment.speaker ? `${segment.speaker}: ` : ''}${speechDisplayText(segment)}`.trim()).join('\n');

export function correctedSpeechSegment(segment, text) {
  if (typeof text !== 'string' || text.length > 4000) throw new Error('A passage must contain at most 4000 characters.');
  return { ...segment, text, ...(segment.quality ? {
    quality: { ...segment.quality, status: 'reviewed', original_text: segment.quality.original_text ?? segment.text },
  } : {}) };
}

export function reviewPassage(result, index, text) {
  if (!needsSpeechReview(result?.segments?.[index])) throw new Error('This passage is no longer awaiting review.');
  const segments = result.segments.map((segment, position) => position === index ? correctedSpeechSegment(segment, typeof text === 'string' ? text.trim() : text) : segment);
  return { ...result, segments, transcript: speechTranscript(segments), summary: '', action_items: [],
    insights: { decisions: [], risks: [], open_questions: [] }, chat_history: [], review_status: 'draft' };
}
