// Public entry routes are separate from the authenticated application's page list.
export const PREVIEW_PAGES = ['overview', 'meetings', 'tasks', 'projects'];
export function getEntryRoute() {
  const path = globalThis.location?.hash?.split('?')[0] || '';
  const callbackError = new URLSearchParams(globalThis.location?.search).get('auth_error');
  if (!path && ['cancelled', 'provider_failed'].includes(callbackError)) return 'signin';
  if (!path || ['#/landing', '#/home'].includes(path)) return 'landing';
  if (path === '#/signin') return 'signin';
  if (path === '#/preview' || path.startsWith('#/preview/')) {
    const section = path.split('/')[2];
    return `preview/${PREVIEW_PAGES.includes(section) ? section : 'overview'}`;
  }
  return 'workspace';
}
export function navigateEntry(page, section = 'overview') {
  if (!['landing', 'signin', 'preview'].includes(page))
    throw new RangeError('Unknown public page');
  window.location.hash =
    page === 'preview'
      ? `#/preview/${PREVIEW_PAGES.includes(section) ? section : 'overview'}`
      : `#/${page}`;
}
