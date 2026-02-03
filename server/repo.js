import crypto from 'node:crypto';

export function nowIso() {
  return new Date().toISOString();
}

export const INDIAN_LANGUAGES = [
  'Hindi',
  'Kannada',
  'Telugu',
  'Tamil',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Punjabi'
];

export const INDIAN_LANGUAGES_LOWER = INDIAN_LANGUAGES.map((l) => l.toLowerCase());

export function makeId(prefix, numericId) {
  return `${prefix}:${numericId}`;
}

export function hashId(prefix, input) {
  const h = crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 12);
  return `${prefix}:${h}`;
}

export function toIsoDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function statusFrom(releaseDate, hasStreaming) {
  const iso = toIsoDate(releaseDate);
  if (!iso) return 'Announced';
  const today = new Date().toISOString().slice(0, 10);
  if (iso > today) return 'Upcoming';
  if (hasStreaming) return 'Streaming';
  return 'Now Showing';
}

// Basic Soundex (good enough for "sounds like" across English transliterations).
export function soundex(input) {
  const s = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (!s) return '';

  const first = s[0];
  const map = (ch) => {
    switch (ch) {
      case 'B':
      case 'F':
      case 'P':
      case 'V':
        return '1';
      case 'C':
      case 'G':
      case 'J':
      case 'K':
      case 'Q':
      case 'S':
      case 'X':
      case 'Z':
        return '2';
      case 'D':
      case 'T':
        return '3';
      case 'L':
        return '4';
      case 'M':
      case 'N':
        return '5';
      case 'R':
        return '6';
      default:
        return '0';
    }
  };

  let out = first;
  let last = map(first);
  for (let i = 1; i < s.length; i++) {
    const code = map(s[i]);
    if (code === '0') {
      last = code;
      continue;
    }
    if (code !== last) out += code;
    last = code;
  }

  out = out.replace(/0/g, '');
  return (out + '000').slice(0, 4);
}
