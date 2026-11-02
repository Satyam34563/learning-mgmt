import { useState } from 'react';
import { youtubeId } from './Player';

/**
 * A lecture's thumbnail: YouTube's own image for YouTube links (built from the video id, no extra request),
 * otherwise a neutral play tile. Optional duration badge and progress bar along the bottom.
 */
export default function VideoThumb({
  url,
  minutes,
  progress,
  size = 'md',
  className = '',
}: {
  url?: string;
  minutes?: number;
  progress?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const id = url ? youtubeId(url) : undefined;
  const [failed, setFailed] = useState(false);
  const src = id && !failed ? `https://i.ytimg.com/vi/${id}/${size === 'sm' ? 'mqdefault' : 'hqdefault'}.jpg` : undefined;

  return (
    <span className={`relative block aspect-video shrink-0 overflow-hidden bg-subtle ${className}`}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="grid size-full place-items-center text-accent">
          <span className={`grid place-items-center rounded-full bg-card shadow-sm ${size === 'sm' ? 'size-6' : 'size-10'}`}>
            <svg viewBox="0 0 16 16" className={size === 'sm' ? 'size-2.5' : 'size-4'} fill="currentColor"><path d="M5 3.5v9l7-4.5z" /></svg>
          </span>
        </span>
      )}
      {!!minutes && size === 'md' && (
        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
          {minutes} min
        </span>
      )}
      {progress !== undefined && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
          <span className="block h-full bg-gold" style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
        </span>
      )}
    </span>
  );
}
