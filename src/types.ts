export type Language = 'Hindi' | 'Tamil' | 'Telugu' | 'Kannada' | 'Malayalam' | 'Bengali' | 'Marathi' | 'Punjabi' | 'English' | string;

export interface Song {
  id: string;
  title: string;
  singers: string[];
  youtubeUrl?: string;
  platform?: 'YouTube' | 'Spotify' | 'JioSaavn' | 'Gaana' | 'Apple Music' | string;
  duration?: string;
}

export interface OttOffer {
  provider: string;
  type: 'Streaming' | 'Rent' | 'Buy' | string;
  url?: string; // provider detail page (often JustWatch via TMDB)
  deepLink?: string; // best-effort direct play/search link for the provider
  logo?: string;
  region?: string;
}

export interface RatingSource {
  source: string;
  value: number;
  scale: number;
  count?: number;
  url?: string;
}

export interface ReviewItem {
  source: string;
  author?: string;
  rating?: number;
  url?: string;
  excerpt: string;
}

export interface CastMember {
  personId?: string;
  name: string;
  role?: string;
  character?: string;
  profileUrl?: string;
  tmdbId?: number;
  profileImage?: string;
}

export interface Movie {
  id: string;
  title: string;
  language: Language;
  synopsis: string;
  cast: CastMember[];
  director: string;
  writers?: string[];
  genres: string[];
  themes?: string[];
  runtimeMinutes?: number;
  releaseDate?: string; // ISO date
  status: 'Now Showing' | 'Upcoming' | 'Announced' | 'Streaming';
  poster: string;
  backdrop?: string;
  rating?: number; // 0–10
  certification?: string;
  trailerUrl?: string;
  ott?: OttOffer[];
  songs?: Song[];
  ratings?: RatingSource[];
  reviews?: ReviewItem[];
  sources?: string[]; // provenance of automated fetch
}
