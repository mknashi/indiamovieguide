import { Song } from '../types';
import { RiArrowRightUpLine, RiMusic2Line } from 'react-icons/ri';

interface Props {
  songs: Song[];
}

export function SongRoll({ songs }: Props) {
  if (!songs.length) return null;
  return (
    <div>
      <div className="section-header">
        <h3>Soundtracks &amp; Videos</h3>
        <span className="inline-pill">Play instantly on YouTube</span>
      </div>
      <div className="song-list">
        {songs.map((song) => (
          <div key={song.id} className="song">
            <div>
              <strong>
                <RiMusic2Line style={{ marginRight: 6, verticalAlign: '-2px' }} />
                {song.title}
              </strong>
              <div className="tagline">{song.singers.join(', ')}</div>
            </div>
            {song.youtubeUrl && (
              <a href={song.youtubeUrl} target="_blank" rel="noreferrer">
                Open
                <RiArrowRightUpLine style={{ marginLeft: 6, verticalAlign: '-2px' }} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
