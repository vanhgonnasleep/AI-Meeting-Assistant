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
