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
