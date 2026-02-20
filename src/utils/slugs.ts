const KNOWN_LANGUAGES = ['Hindi', 'Kannada', 'Telugu', 'Tamil', 'Malayalam', 'Marathi', 'Bengali', 'Punjabi', 'English'];

export function slugifySegment(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function decodeSlugLabel(value: string): string {
  return decodeURIComponent(String(value || ''))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleCaseLabel(value: string): string {
  return decodeSlugLabel(value)
    .split(/\s+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function languageFromSlug(value: string): string {
  const target = slugifySegment(value);
  if (!target) return '';
  const known = KNOWN_LANGUAGES.find((lang) => slugifySegment(lang) === target);
  if (known) return known;
  return titleCaseLabel(value);
}
