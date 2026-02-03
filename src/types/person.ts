export interface FilmographyItem {
  tmdbId?: number;
  title: string;
  mediaType?: string;
  character?: string;
  releaseDate?: string | null;
  poster?: string;
}

export interface PersonProfile {
  id: string;
  tmdbId?: number;
  name: string;
  biography: string;
  wikiUrl?: string;
  profileImage?: string;
  filmography: FilmographyItem[];
  sources?: string[];
}
