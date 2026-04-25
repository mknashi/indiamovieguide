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

// Normalization for fuzzy searches. Keeps only lowercase a-z/0-9.
export function normalizeForSearch(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// Build a set of search keys for a person's name covering all likely search variants:
// exact tokens, soundex of each token, compound forms, and the Indian 'a'-bridge compound
// (e.g. "Raj Kumar" → also stores "rajakumar" so that query matches).
export function buildPersonSearchKeys(name) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = norm(name).split(' ').filter((t) => t.length >= 2);
  if (!tokens.length) return [];

  const keys = new Set();
  const add = (k) => {
    const s = String(k || '').trim();
    if (s.length >= 2 && s !== '0000') keys.add(s);
  };

  // Full normalized name: "madhuri dixit"
  add(tokens.join(' '));

  // Each token + its soundex: "madhuri" M360, "dixit" D230
  for (const t of tokens) {
    add(t);
    add(soundex(t));
  }

  if (tokens.length >= 2) {
    // Compound (no space): "madhuridixit" + soundex M363
    add(tokens.join(''));
    add(soundex(tokens.join('')));

    // Adjacent-pair compounds — handles merged spellings and the Indian 'a'-vowel bridge
    // e.g. "Raj Kumar" → "rajkumar" (R256) and "rajakumar" (R225)
    //      "Shah Rukh Khan" → "shahrukh" + "shaharukh" pair keys
    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = tokens[i] + tokens[i + 1];
      add(pair);
      add(soundex(pair));
      const pairA = tokens[i] + 'a' + tokens[i + 1];
      add(pairA);
      add(soundex(pairA));
    }
  }

  return [...keys];
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
