export const APP_PAGES = ['overview', 'studio', 'meetings', 'tasks', 'projects'];

export function resolveAppPage(hash = '') {
  const path = String(hash).split('?')[0];
  const page = path.startsWith('#/') ? path.slice(2) : '';
  return APP_PAGES.includes(page) ? page : 'overview';
}

export function appPageHref(page) {
  if (!APP_PAGES.includes(page)) throw new RangeError('Unknown application page');
  return `#/${page}`;
}

export function subscribeToNavigation(listener) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function getNavigationPage() {
  return resolveAppPage(window.location.hash);
}

export function navigateTo(page) {
  window.location.hash = appPageHref(page);
}

export function canOpenAnotherMeeting({ processing = false, saving = false, editing = false }) {
  return !processing && !saving && !editing;
}

export function formatMeetingDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  const time = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return hours ? `${String(hours).padStart(2, '0')}:${time}` : time;
}
