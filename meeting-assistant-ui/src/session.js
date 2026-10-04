export function normalizeCitation(citation) {
  const label = typeof citation === 'string' ? citation : String(citation?.timestamp || 'Transcript excerpt');
  if (citation && typeof citation === 'object') {
    return { label, seconds: Number.isFinite(citation.start) && citation.start >= 0 ? citation.start : null };
  }
  const match = label.match(/\b(\d{1,3}:\d{2}(?::\d{2})?)\b/);
  if (!match) return { label, seconds: null };
  const parts = match[1].split(':').map(Number);
  if (parts.slice(1).some(part => part >= 60)) return { label, seconds: null };
  return { label, seconds: parts.reduce((total, part) => total * 60 + part, 0) };
}

// Aborting transport alone is insufficient: responses may already be resolving.
export function createRequestGate() {
  let current = null;
  return {
    begin() {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      return { signal: controller.signal, isCurrent: () => current === controller && !controller.signal.aborted };
    },
    cancel() {
      current?.abort();
      current = null;
    },
  };
}

// Topics come from the current source text, not unverified generated summaries/tasks.
export function getSuggestedPrompts(result) {
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  let texts = segments.map(segment => typeof segment?.text === 'string' ? segment.text : '').filter(text => text.trim());
  const fromSegments = texts.length > 0;
  if (!texts.length && typeof result?.transcript === 'string') texts = [result.transcript];
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
  // Prefer distinct categories before filling with other transcript excerpts.
  const selected = [];
  for (const category of ['decision', 'follow-up', 'risk', 'question', 'topic']) {
    const candidate = candidates.find(item => item.category === category);
    if (candidate && selected.length < 4) selected.push(candidate);
  }
  for (const candidate of candidates) {
    if (selected.length >= 4) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected.map(({ excerpt, category }) => {
    if (category === 'decision') return `What decision, if any, is discussed in “${excerpt}”?`;
    if (category === 'follow-up') return `What follow-up, if any, is discussed in “${excerpt}”?`;
    if (category === 'risk') return `What does the meeting say about the concern in “${excerpt}”?`;
    return `What does the meeting say about “${excerpt}”?`;
  });
}

export function buildChatPayload({ question, meetingId, model, isDemo, result }) {
  if (meetingId) return { question, model, meeting_id: meetingId };
  return { question, model, demo_mode: Boolean(isDemo), transcript: result?.transcript || '',
    summary: result?.summary || '', segments: result?.segments || null, language: result?.language || 'en' };
}

export function resultFromMeeting(meeting) {
  const segments = (Array.isArray(meeting.segments) ? meeting.segments : [])
    .filter(segment => segment && typeof segment === 'object').map(segment => ({ ...segment, text: String(segment.text ?? '') }));
  return {
    transcript: meeting.raw_transcript || '', summary: meeting.executive_summary || '',
    action_items: meeting.action_items || [], insights: meeting.insights || { decisions: [], risks: [], open_questions: [] },
    chat_history: meeting.chat_history || [], duration: meeting.duration, language: meeting.language,
    segments,
    speakers: [...new Set(segments.map(segment => segment.speaker).filter(Boolean))],
  };
}

export function editSpeakerAttribution(result, oldName, newName, segmentIndex = null) {
  const affected = (result.segments || []).filter((segment, index) => segment.speaker === oldName && (segmentIndex === null || index === segmentIndex));
  const starts = new Set(affected.map(segment => segment.start));
  const evidence = item => item && typeof item === 'object' && item.speaker === oldName &&
    (segmentIndex === null || (item.start != null && starts.has(item.start))) ? { ...item, speaker: newName } : item;
  const segments = (result.segments || []).map((segment, index) =>
    segment.speaker === oldName && (segmentIndex === null || index === segmentIndex) ? { ...segment, speaker: newName } : segment);
  return { ...result, segments, speakers: [...new Set(segments.map(segment => segment.speaker).filter(Boolean))],
    transcript: segments.filter(segment => segment.text?.trim()).map(segment => `${segment.timestamp || ''} ${segment.speaker || 'Speaker'}: ${segment.text}`.trim()).join('\n'),
    insights: Object.fromEntries(Object.entries(result.insights || {}).map(([key, items]) => [key, Array.isArray(items) ? items.map(evidence) : items])),
    chat_history: (result.chat_history || []).map(message => ({ ...message, citations: (message.citations || []).map(evidence) })),
  };
}
