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
                <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiMusic2Line  /></span>
                {song.title}
              </strong>
              <div className="tagline">{song.singers.join(', ')}</div>
            </div>
            {song.youtubeUrl && (
              <a href={song.youtubeUrl} target="_blank" rel="noreferrer">
                Open
                <span style={{marginLeft: 6, display: 'inline-flex', alignItems: 'center'}}><RiArrowRightUpLine  /></span>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
