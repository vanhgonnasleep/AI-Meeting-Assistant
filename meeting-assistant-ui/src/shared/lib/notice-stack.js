/** Shared geometry only; notification content remains owned by its feature. */
export function createNoticeStack() {
  let entries = [];
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => entries,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(id, height, scope) {
      const current = entries.find(entry => entry.id === id);
      if (current?.height === height && current.scope === scope) return;
      const next = { id, height, scope };
      entries = current ? entries.map(entry => entry.id === id ? next : entry) : [...entries, next];
      emit();
    },
    remove(id) {
      if (!entries.some(entry => entry.id === id)) return;
      entries = entries.filter(entry => entry.id !== id);
      emit();
    },
    layout(id) {
      const current = entries.find(entry => entry.id === id);
      if (!current) return { offset: 0, count: 1 };
      const siblings = entries.filter(entry => entry.scope === current.scope);
      return { offset: siblings.slice(0, siblings.indexOf(current)).reduce((offset, entry) => offset + entry.height + 12, 0), count: siblings.length };
    },
  };
}

export const noticeStack = createNoticeStack();
