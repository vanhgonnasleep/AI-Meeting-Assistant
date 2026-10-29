const SPEAKER_BADGE_STYLES = [
  'bg-blue-500/15 text-blue-700 border-blue-500/30',
  'bg-purple-500/15 text-purple-700 border-purple-500/30',
  'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  'bg-amber-500/15 text-amber-700 border-amber-500/30',
  'bg-pink-500/15 text-pink-700 border-pink-500/30',
  'bg-teal-500/15 text-teal-700 border-teal-500/30',
  'bg-orange-500/15 text-orange-700 border-orange-500/30',
  'bg-cyan-500/15 text-cyan-700 border-cyan-500/30',
];

const SPEAKER_AVATAR_STYLES = [
  'bg-blue-600 text-white shadow-blue-500/25',
  'bg-purple-600 text-white shadow-purple-500/25',
  'bg-emerald-600 text-white shadow-emerald-500/25',
  'bg-amber-600 text-white shadow-amber-500/25',
  'bg-pink-600 text-white shadow-pink-500/25',
  'bg-teal-600 text-white shadow-teal-500/25',
  'bg-orange-600 text-white shadow-orange-500/25',
  'bg-cyan-600 text-white shadow-cyan-500/25',
];

export const getSpeakerBadgeStyle = (speaker) => {
  if (!speaker) return 'bg-slate-100 text-slate-700 border-slate-300';
  const s = String(speaker);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_BADGE_STYLES[hash % SPEAKER_BADGE_STYLES.length];
};

export const getSpeakerAvatarStyle = (speaker) => {
  if (!speaker) return 'bg-slate-500 text-white shadow-slate-500/25';
  const s = String(speaker);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_AVATAR_STYLES[hash % SPEAKER_AVATAR_STYLES.length];
};

export const getSpeakerInitial = (speaker) => {
  if (!speaker) return '?';
  const match = speaker.match(/\d+/);
  if (match) return match[0];
  return speaker.charAt(0).toUpperCase();
};
