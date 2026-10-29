/**
 * Subtitles Utility: Generate and download standard SubRip (.SRT) and WebVTT (.VTT)
 * from Clarion AI meeting transcript segments.
 */

/**
 * Format seconds into SRT timestamp: HH:MM:SS,mmm
 * Example: 65.45 -> "00:01:05,450"
 */
export function formatTimestampSrt(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00,000';
  const totalMs = Math.round(totalSeconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(milliseconds).padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Format seconds into WebVTT timestamp: HH:MM:SS.mmm
 * Example: 65.45 -> "00:01:05.450"
 */
export function formatTimestampVtt(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00.000';
  const totalMs = Math.round(totalSeconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(milliseconds).padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Sanitize text for subtitle cues
 */
function cleanCueText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/\r\n|\r|\n/g, ' ');
}

/**
 * Generate standard SubRip (.srt) subtitle string
 */
export function generateSrt(segments = []) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return '';
  }

  const cues = [];
  let index = 1;

  for (const seg of segments) {
    if (!seg || typeof seg !== 'object') continue;
    const startSec = Number(seg.start) || 0;
    const endSec = Number(seg.end) || (startSec + 2.5);
    const text = cleanCueText(seg.text);
    if (!text) continue;

    const speaker = seg.speaker ? `[${seg.speaker}] ` : '';
    const startTs = formatTimestampSrt(startSec);
    const endTs = formatTimestampSrt(Math.max(startSec + 0.5, endSec));

    cues.push(`${index}\n${startTs} --> ${endTs}\n${speaker}${text}\n`);
    index++;
  }

  return cues.join('\n');
}

/**
 * Generate standard WebVTT (.vtt) subtitle string
 */
export function generateVtt(segments = []) {
  const header = 'WEBVTT - Clarion AI Subtitles\n\n';
  if (!Array.isArray(segments) || segments.length === 0) {
    return header;
  }

  const cues = [];
  let index = 1;

  for (const seg of segments) {
    if (!seg || typeof seg !== 'object') continue;
    const startSec = Number(seg.start) || 0;
    const endSec = Number(seg.end) || (startSec + 2.5);
    const text = cleanCueText(seg.text);
    if (!text) continue;

    const startTs = formatTimestampVtt(startSec);
    const endTs = formatTimestampVtt(Math.max(startSec + 0.5, endSec));
    const voice = seg.speaker ? `<v ${seg.speaker}>[${seg.speaker}]: ` : '';
    const voiceClose = seg.speaker ? '</v>' : '';

    cues.push(`${index}\n${startTs} --> ${endTs}\n${voice}${text}${voiceClose}\n`);
    index++;
  }

  return header + cues.join('\n');
}

/**
 * Trigger browser file download from string content
 */
export function downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Download meeting transcript as .SRT file
 */
export function downloadSrt(segments, title = 'meeting') {
  const cleanTitle = (title || 'meeting').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const srtContent = generateSrt(segments);
  downloadFile(srtContent, `${cleanTitle}_subtitles.srt`, 'text/plain;charset=utf-8');
}

/**
 * Download meeting transcript as .VTT file
 */
export function downloadVtt(segments, title = 'meeting') {
  const cleanTitle = (title || 'meeting').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const vttContent = generateVtt(segments);
  downloadFile(vttContent, `${cleanTitle}_subtitles.vtt`, 'text/vtt;charset=utf-8');
}

/**
 * Create a live WebVTT Blob URL for HTML5 <track>
 */
export function createVttBlobUrl(segments) {
  const vttContent = generateVtt(segments);
  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  return URL.createObjectURL(blob);
}
