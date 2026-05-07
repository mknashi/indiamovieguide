import { useEffect, useMemo, useState } from 'react';
import { MovieCard } from '../components/MovieCard';
import type { Movie } from '../types';
import { decodeSlugLabel, languageFromSlug, titleCaseLabel } from '../utils/slugs';
import { navigate } from '../router';

type Mode = 'all' | 'language' | 'genre';

type BrowsePayload = {
  movies: Movie[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  filters?: { lang?: string | null; genre?: string | null };
  _route?: string;
  _key?: string;
};

const GENRE_INTROS: Record<string, string> = {
  Action:
    'Indian action cinema has evolved from the stunt-driven masala films of the 1970s and 80s into a globally competitive spectacle genre. Telugu blockbusters like RRR and the KGF franchise redefined what Indian action films could achieve technically and commercially. Tamil action films from directors like Shankar and Lokesh Kanagaraj blend stylized choreography with layered storytelling. Kannada\'s Kantara brought mythological action to a global audience. Hindi action franchises like War and Pathaan have raised production values across Bollywood. Whether you are looking for high-concept set pieces or gritty street-level action, this section tracks releases across all major Indian languages.',
  Drama:
    'Drama is the backbone of Indian cinema, encompassing intimate family stories, social epics, and literary adaptations across all industries. Malayalam cinema in particular has elevated the dramatic form, producing realistic character studies that have drawn international critical attention. Hindi art house films from directors like Anurag Kashyap and Vikramaditya Motwane, Tamil socially aware dramas, and Telugu emotional family films all share this category. Drama in Indian films rarely exists in isolation — comedy, romance, and social commentary are woven together rather than separated. This section covers dramatic releases across India\'s eight major film industries.',
  Romance:
    'Romance is among the most commercially dominant genres across all Indian film industries. Hindi cinema built its global identity on sweeping love stories — from Dilwale Dulhania Le Jayenge to more recent hits. Tamil romantic dramas tend toward poetic, literary writing, while Telugu romances often favor high-energy entertainers anchored by strong music. Malayalam romance films explore unconventional and mature relationship dynamics with nuance. Marathi and Kannada romantic films draw on regional folk and literary traditions. Across all industries, the love story provides emotional architecture for films that also incorporate action, comedy, and family dynamics.',
  Comedy:
    'Indian comedy spans a huge range — from physical slapstick comedies of the 1960s and 70s, to the ensemble comedies popularized by Bollywood hits like Golmaal and Hera Pheri, to the sharp satirical films that Malayalam cinema regularly produces. Comedy is rarely a standalone genre in Indian films; it is woven into action, romance, and drama as an essential ingredient. Pure comedy films tend to perform strongest regionally, where dialect humor, local character types, and cultural references resonate most deeply. Paresh Rawal, Sreenivasan, and Johnny Lever represent different regional traditions that have each contributed to a rich comedic culture.',
  Thriller:
    'Psychological and procedural thrillers have become one of the fastest-growing genres in Indian OTT-era filmmaking. Malayalam cinema leads the category with tightly plotted crime thrillers like Drishyam, Joseph, and Forensic. Tamil cinema has contributed acclaimed entries including Vikram Vedha and Kolai. Hindi thrillers on Netflix and Amazon Prime have found large national audiences through writers who favor tight plotting over spectacle. The genre rewards smart screenwriting and grounded performances, making it a natural fit for streaming-first productions with modest budgets. This section tracks thriller releases across all Indian film industries.',
  Crime:
    'Crime films have a long and celebrated history in Indian cinema. Bollywood\'s tradition of gangster and underworld films runs from Deewaar through Satya to Gangs of Wasseypur. Tamil crime films like Vikram and Kaithi blend procedural energy with action spectacle. Telugu crime dramas explore family rivalry and political corruption. Malayalam crime films tend toward psychological realism — films like Drishyam and Forensic are built on meticulous plotting rather than gunfights. Bengali crime thrillers draw on Kolkata\'s noir tradition. OTT platforms have accelerated the production of long-form crime stories across all languages, with multi-episode films and series formats pushing the genre in new directions.',
  Horror:
    'Indian horror has grown significantly in ambition and quality over the past decade. Malayalam horror films like Bhoothakaalam and Ezra have brought supernatural storytelling to a new level of craft. Tamil horror from directors like Prashanth Neel and Selvamani explores folklore and regional ghost traditions. Bollywood horror has a longer commercial history, from Ramsay Brothers B-movies to polished contemporary productions like Stree and Bhool Bhulaiyaa. Kannada cinema\'s Kantara incorporates powerful folk horror elements into its narrative. The genre\'s relationship with Indian religious, mythological, and folk traditions gives it a distinct flavor that differs markedly from Western horror conventions.',
  Family:
    'Family entertainers form the commercial backbone of Indian cinema — films designed to appeal to multiple generations simultaneously, blending action or comedy with emotional family dynamics. Telugu and Tamil cinema have strong traditions of family entertainers built around joint families, generational conflict, and reconciliation. Bollywood family films from Rajshri Productions and similar banners have defined a wholesome mainstream tradition for decades. Malayalam family dramas explore more complex, realistic family relationships. Marathi family films draw on the joint Hindu family as a site of both warmth and tension. The family entertainer often provides the ideal showcase for veteran character actors alongside the leading stars.',
  History:
    'Historical films give Indian cinema a canvas to explore the subcontinent\'s extraordinarily rich past. Bollywood period epics like Padmaavat, Bajirao Mastani, and the Tanhaji franchise dramatize Mughal-era and Maratha history for mass audiences. Tamil historical films including Ponniyin Selvan excavate medieval South Indian dynasties with grandeur. Telugu historical epics like Magadheera blend mythology with period action. Malayalam cinema has produced serious historical dramas about Kerala\'s own complex past. Marathi films regularly dramatize the life of Chhatrapati Shivaji Maharaj and other regional heroes. Historical films in India carry significant cultural weight, and their representation of disputed events is often politically charged and publicly debated.',
  Biography:
    'Biographical films — biopics — have become a dominant prestige genre in Indian cinema. Bollywood has produced celebrated biopics on sports figures (Dhoni, Saina, 83), political figures (Thackeray, PM Narendra Modi), and entertainers. Tamil and Telugu biographical films have dramatized the lives of regional political and cultural icons. Malayalam biopics tend toward intimate character studies. The genre has benefited from the rise of streaming, where longer run times and more complex narratives find willing audiences. Indian biopics often navigate the tension between historical fidelity and the demands of popular entertainment, and the most successful films balance both without reducing their subjects to hagiography.',
  Animation:
    'Indian animation has grown steadily as a production sector, with studios across Mumbai, Hyderabad, and Chennai providing services for global productions while developing domestic content. Bollywood animated films targeting children — often based on mythological figures like Hanuman, Ganesha, and Chhota Bheem — have built loyal audiences. Regional language animated productions have expanded alongside national ones. The OTT boom has given Indian animation studios new distribution channels and new reasons to invest in original content. While the industry has not yet produced an animated film to rival the international profile of its live-action counterparts, the technical infrastructure and creative ambition are both growing rapidly.',
  Mystery:
    'Mystery as a genre in Indian cinema typically overlaps with thriller and crime, but pure mystery films — focused on puzzle-solving and revelation rather than action — have found a dedicated audience, particularly through OTT streaming. Malayalam cinema has a strong mystery tradition with films like Drishyam (which is as much a procedural mystery as a thriller) and newer whodunit-style films. Hindi OTT productions have embraced the locked-room mystery and investigative procedural formats. Tamil mystery films often blend supernatural elements with procedural investigation. The genre rewards careful viewers and has built an enthusiastic fan base that follows plot details closely.',
  Adventure:
    'Adventure films occupy a specific niche in Indian cinema — big-budget fantasies and historical action-adventures often marketed to family audiences. The Baahubali films are the defining example of the contemporary Indian adventure epic, combining CGI spectacle with mythological storytelling at a scale previously unseen in domestic production. Bollywood adventure films have historically targeted children and family audiences. Tamil and Telugu mythological adventures draw on the Ramayana, Mahabharata, and Puranic traditions as source material. The adventure genre in India is closely intertwined with action, history, and fantasy — few pure adventure films exist outside those broader genre categories.',
  Fantasy:
    'Fantasy cinema in India draws on one of the world\'s richest mythological traditions. The epics — Ramayana and Mahabharata — and the vast body of Puranic literature provide ready-made fantasy worlds populated with gods, demons, celestial weapons, and cosmic stakes. Films like Krrish brought superhero fantasy into a Bollywood context. Magadheera merged fantasy with historical action. Brahmastra attempted to build a cinematic universe around Hindu mythology. Regional industries have produced their own fantasy traditions rooted in specific local folklore. As visual effects become more affordable, Indian fantasy filmmaking is becoming more ambitious, and streaming platforms are investing in long-form fantasy series alongside theatrical films.',
  'Science Fiction':
    'Science fiction has historically been an underdeveloped genre in Indian cinema, partly because of the high production costs required for convincing futuristic or speculative settings. That is changing. Tamil cinema has produced some of the most ambitious Indian sci-fi — Shankar\'s Enthiran (Robot) and 2.0 blend social commentary with spectacular effects. Bollywood\'s Ra.One and Koi... Mil Gaya built superhero and alien-contact narratives for mainstream audiences. More recent productions have embraced near-future and dystopian settings accessible without enormous budgets. OTT originals have opened space for thoughtful, lower-budget speculative fiction that prioritizes ideas over spectacle, and the next decade may see Indian sci-fi mature significantly as a genre.',
  Musical:
    'India produces more film music than any other country, and music is so deeply embedded in mainstream Indian cinema that almost every commercial film is, in some sense, a musical. But films that foreground music as their central subject — biopics of musicians, films about classical or folk traditions, films structured around performance — occupy a distinct category. Bollywood has produced acclaimed musical biopics including Rockstar and Tansen. Tamil films about the classical Carnatic tradition, Malayalam films exploring folk music, and Punjabi films celebrating regional pop culture all fall here. The music industry and the film industry in India are so deeply intertwined that their products are almost inseparable.',
  Documentary:
    'Indian documentary filmmaking has a distinguished tradition, from the Films Division of India\'s mid-century public films to the independent feature documentaries that now reach global audiences through streaming. Directors like Anand Patwardhan, Paromita Vohra, and Shaunak Sen have brought Indian non-fiction filmmaking international recognition. Subjects range from political history to environmental crisis to cultural traditions to personal stories. OTT platforms have invested in high-profile Indian documentary series — true crime, historical investigations, and celebrity profiles — that have attracted mainstream audiences who would not have sought out traditional documentary cinema.',
  War:
    'War films occupy a unique place in Indian cinema, shaped by the country\'s specific military history: the 1947 and 1971 wars with Pakistan, the 1962 conflict with China, the Kargil war of 1999, and the ongoing struggle against terrorism. Border (1997) and LOC Kargil dramatized real battles for mass audiences. More recent films like Uri: The Surgical Strike and Shershaah have brought contemporary military operations to the screen. The genre has a strong patriotic dimension in Bollywood but has also produced films that examine the human cost of conflict with more complexity. Tamil and Telugu war films have explored South Indian military history and counterterrorism operations.',
  Sport:
    'Indian sports cinema has become one of the most commercially and critically successful genre categories in Bollywood over the past fifteen years. Films like Chak De! India, Dangal, Lagaan, Mary Kom, 83, and Soorma have dramatized real sporting achievements with genuine emotional power, often combining sports drama with social commentary about gender, caste, or national identity. Cricket and wrestling provide the most common settings, but films about boxing, badminton, football, and hockey have also found large audiences. Regional industries — Tamil, Telugu, Kannada — have produced their own sports films drawing on local sporting culture. The genre\'s appeal crosses demographic lines and reliably attracts viewers who would not typically choose action or romance films.',
  Western:
    'Indian Western films draw on the Spaghetti Western and classical Hollywood Western traditions but set them in Indian landscapes and historical contexts — frontier zones like Chambal, colonial-era deserts, or fictional lawless territories. The genre is relatively rare in Indian cinema but produces occasional high-profile entries. Sholay (1975) remains the foundational Indian Western, transposing the aesthetics of Leone and Kurosawa to rural Rajasthan. More recent films have revisited bandit-territory settings with updated production values. The genre provides a framework for exploring themes of justice, revenge, and the limits of law that translate across cultures.',
};

// Module-level cache so back-navigation and repeated tab-switching is instant.
const browseCache = new Map<string, { data: BrowsePayload; ts: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Seed cache from server-injected initial data on first JS load.
if (typeof window !== 'undefined') {
  const d = (window as any).__INITIAL_DATA__;
  if (d?._route === 'browse') {
    browseCache.set(d._key, { data: d as BrowsePayload, ts: Date.now() });
    delete (window as any).__INITIAL_DATA__;
  }
}

function getCached(key: string): BrowsePayload | null {
  const c = browseCache.get(key);
  return c && Date.now() - c.ts < CACHE_TTL ? c.data : null;
}

export function MoviesIndexPage({ mode, slug }: { mode: Mode; slug?: string }) {
  const lang = useMemo(() => (mode === 'language' ? languageFromSlug(slug || '') : ''), [mode, slug]);
  const genreLabel = useMemo(() => (mode === 'genre' ? titleCaseLabel(slug || '') : ''), [mode, slug]);
  const currentKey = mode === 'language' ? `language:${slug}` : mode === 'genre' ? `genre:${slug}` : 'all';

  const heading = useMemo(() => {
    if (mode === 'language') return `${lang || 'Language'} Movies`;
    if (mode === 'genre') return `${genreLabel || 'Genre'} Movies`;
    return 'Movie Index';
  }, [genreLabel, lang, mode]);

  const genreIntro = mode === 'genre' ? (GENRE_INTROS[genreLabel] ?? null) : null;

  const [loading, setLoading] = useState(() => !getCached(currentKey));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BrowsePayload | null>(() => getCached(currentKey));

  const fetchPage = async (page: number) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '24');
    if (mode === 'language' && slug) {
      params.set('langSlug', slug);
      if (lang) params.set('lang', lang);
    }
    if (mode === 'genre' && slug) {
      params.set('genreSlug', slug);
      params.set('genre', decodeSlugLabel(slug));
    }
    const res = await fetch(`/api/browse?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data as BrowsePayload;
  };

  useEffect(() => {
    const cached = getCached(currentKey);
    if (cached) {
      setPayload(cached);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    setPayload(null);

    (async () => {
      try {
        const data = await fetchPage(1);
        if (!alive) return;
        browseCache.set(currentKey, { data, ts: Date.now() });
        setPayload(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load movies');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [currentKey]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>{heading}</h3>
          <div className="tagline">
            {payload?.total != null ? `${payload.total} titles` : 'Discover Indian cinema titles'}
          </div>
        </div>
        <span className="inline-pill">Index</span>
      </div>

      <div className="meta" style={{ marginTop: 8 }}>
        <a
          className="chip"
          href="/movies"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate('/movies');
          }}
        >
          All movies
        </a>
        <a
          className="chip"
          href="/people"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate('/people');
          }}
        >
          People index
        </a>
      </div>

      {genreIntro && (
        <div className="detail" style={{ marginTop: 14 }}>
          <div className="tagline" style={{ lineHeight: 1.8 }}>{genreIntro}</div>
        </div>
      )}

      {loading && <div className="tagline" style={{ marginTop: 12 }}>Loading…</div>}
      {error && <div className="tagline" style={{ marginTop: 12 }}>Failed to load: {error}</div>}

      {!loading && !error && (
        <>
          <div className="grid" style={{ marginTop: 12 }}>
            {(payload?.movies || []).map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
          {payload?.hasMore ? (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <button
                className="ghost-button"
                type="button"
                disabled={loadingMore}
                onClick={async () => {
                  if (!payload) return;
                  const nextPage = Number(payload.page || 1) + 1;
                  try {
                    setLoadingMore(true);
                    const next = await fetchPage(nextPage);
                    browseCache.set(currentKey, {
                      data: { ...next, movies: [...(payload.movies || []), ...(next.movies || [])] },
                      ts: Date.now(),
                    });
                    setPayload((prev) => {
                      if (!prev) return next;
                      return { ...next, movies: [...(prev.movies || []), ...(next.movies || [])] };
                    });
                  } catch {
                    // ignore
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
