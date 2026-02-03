export async function youtubeSearch(query, opts = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const debug = process.env.DEBUG_SONGS === '1';
  if (!apiKey) {
    if (debug) console.log('[youtube] missing YOUTUBE_API_KEY');
    return [];
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(opts.maxResults || 6));
  // Optional: when we specifically need iframe embedding, request embeddable results.
  if (opts.embeddableOnly) url.searchParams.set('videoEmbeddable', 'true');
  if (opts.videoCategoryId) url.searchParams.set('videoCategoryId', String(opts.videoCategoryId));
  if (opts.relevanceLanguage) url.searchParams.set('relevanceLanguage', String(opts.relevanceLanguage));
  if (opts.regionCode) url.searchParams.set('regionCode', String(opts.regionCode));
  url.searchParams.set('key', apiKey);

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    if (debug) console.log('[youtube] fetch failed', { message: e?.message || String(e) });
    throw e;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (debug) {
      console.log('[youtube] search failed', {
        status: res.status,
        query,
        body: String(body || '').slice(0, 300)
      });
    }
    throw new Error(`YouTube search failed: ${res.status} ${body}`);
  }
  const data = await res.json();

  return (data.items || []).map((item) => ({
    title: item.snippet?.title,
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    channel: item.snippet?.channelTitle,
    publishedAt: item.snippet?.publishedAt,
    thumbnail: item.snippet?.thumbnails?.high?.url,
    description: item.snippet?.description
  }));
}
