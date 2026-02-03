import { useEffect, useRef, useState } from 'react';
import { RiSearchLine } from 'react-icons/ri';

export function SearchBar({
  initialQuery,
  onSubmit
}: {
  initialQuery: string;
  onSubmit: (q: string) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="detail" style={{ marginTop: 14 }}>
      <div className="search" style={{ margin: 0 }}>
        <input
          ref={inputRef}
          placeholder="Search by movie, cast, genre, theme…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            onSubmit(q.trim());
          }}
        />
        <button onClick={() => onSubmit(q.trim())}>
          <span style={{marginRight: 8, display: 'inline-flex', alignItems: 'center'}}><RiSearchLine  /></span>
          Search
        </button>
      </div>
    </div>
  );
}

