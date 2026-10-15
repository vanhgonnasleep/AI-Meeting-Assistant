/**
 * Notta Bot Utilities: Platform detection, branding, and payload validation
 */

/**
 * Detects online meeting platform from raw URL string
 * @param {string} url 
 * @returns {'google-meet'|'zoom'|'teams'|'webex'|'youtube'|'generic'|null}
 */
export function detectMeetingPlatform(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Basic check for URL structure
  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const candidate = hasProtocol ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    
    if (host.includes('meet.google.com')) return 'google-meet';
    if (host.includes('zoom.us')) return 'zoom';
    if (host.includes('teams.microsoft.com') || host.includes('teams.live.com')) return 'teams';
    if (host.includes('webex.com')) return 'webex';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (parsed.hostname.includes('.') && parsed.pathname.length >= 0) return 'generic';
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns branding and display styles for the detected platform
 * @param {string} platform 
 * @returns {{ label: string, color: string, badgeClass: string }}
 */
export function getPlatformDetails(platform) {
  switch (platform) {
    case 'google-meet':
      return {
        label: 'Google Meet',
        color: '#00897b',
        badgeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
      };
    case 'zoom':
      return {
        label: 'Zoom Meeting',
        color: '#2d8cff',
        badgeClass: 'bg-blue-500/15 text-blue-700 border-blue-500/30'
      };
    case 'teams':
      return {
        label: 'Microsoft Teams',
        color: '#6264a7',
        badgeClass: 'bg-purple-500/15 text-purple-700 border-purple-500/30'
      };
    case 'webex':
      return {
        label: 'Cisco Webex',
        color: '#00c853',
        badgeClass: 'bg-teal-500/15 text-teal-700 border-teal-500/30'
      };
    case 'youtube':
      return {
        label: 'YouTube Stream',
        color: '#ff0000',
        badgeClass: 'bg-rose-500/15 text-rose-700 border-rose-500/30'
      };
    default:
      return {
        label: 'Live Web Stream',
        color: '#6366f1',
        badgeClass: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30'
      };
  }
}

/**
 * Validates whether string is a safe, usable meeting URL
 * @param {string} url 
 * @returns {boolean}
 */
export function validateMeetingUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith('javascript:') || trimmed.toLowerCase().startsWith('data:')) return false;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname && parsed.hostname.includes('.') && !parsed.hostname.startsWith('.'));
  } catch {
    return false;
  }
}

/**
 * Formats a ready-to-dispatch payload and confirmation message for the AI meeting bot
 * @param {object} options
 * @param {string} options.url
 * @param {string} [options.botName]
 * @param {string} [options.language]
 * @returns {object}
 */
export function formatBotJoinConfirmation({ url, botName = 'AI Assistant Bot', language = 'auto' }) {
  const trimmed = String(url || '').trim();
  const safeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const platform = detectMeetingPlatform(safeUrl) || 'generic';
  const details = getPlatformDetails(platform);

  return {
    url,
    platform,
    platformLabel: details.label,
    botName: (botName || 'AI Assistant Bot').trim(),
    language,
    readyMessage: `Bot "${botName}" is configured to join ${details.label} and transcribe live audio into structured minutes.`
  };
}
