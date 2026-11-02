import { useEffect, useRef } from 'react';

/**
 * Plays YouTube, Google Drive, and direct video files. Reports playback position
 * through `onProgress` (YouTube + direct files only; Drive embeds can't be tracked).
 */
interface Props {
  url: string;
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
}

export function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1];
}
const driveId = (url: string) => url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1];
const isFile = (url: string) => /\.(mp4|webm|ogg|m4v|mov)(\?|$)/i.test(url) || url.startsWith('/uploads/');

export const isTrackable = (url: string) => Boolean(youtubeId(url) || isFile(url));

export default function Player({ url, startAt = 0, onProgress }: Props) {
  const yt = youtubeId(url);
  const drive = driveId(url);
  const frame = 'aspect-video w-full overflow-hidden rounded-lg bg-black';

  if (yt) return <YouTube id={yt} startAt={startAt} onProgress={onProgress} className={frame} />;
  if (drive) {
    return <iframe className={frame} src={`https://drive.google.com/file/d/${drive}/preview`} allow="autoplay; fullscreen" allowFullScreen title="Lecture video" />;
  }
  if (isFile(url)) return <FileVideo url={url} startAt={startAt} onProgress={onProgress} className={frame} />;
  return (
    <div className={`${frame} grid place-items-center text-sm text-zinc-300`}>
      <a href={url} target="_blank" rel="noreferrer" className="underline">Open video in a new tab ↗</a>
    </div>
  );
}

function FileVideo({ url, startAt, onProgress, className }: Props & { className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const last = useRef(0);
  return (
    <video
      ref={ref}
      className={className}
      src={url}
      controls
      preload="metadata"
      onLoadedMetadata={(e) => {
        if (startAt && startAt < e.currentTarget.duration - 5) e.currentTarget.currentTime = startAt;
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (Math.abs(v.currentTime - last.current) >= 15) {
          last.current = v.currentTime;
          onProgress?.(v.currentTime, v.duration);
        }
      }}
      onPause={(e) => onProgress?.(e.currentTarget.currentTime, e.currentTarget.duration)}
      onEnded={(e) => onProgress?.(e.currentTarget.duration, e.currentTarget.duration)}
    />
  );
}

/* ---------- YouTube IFrame API ---------- */

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: Record<string, number> };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady: Promise<void> | undefined;
function loadYouTubeApi() {
  ytReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytReady;
}

function YouTube({ id, startAt, onProgress, className }: { id: string; startAt: number; onProgress?: Props['onProgress']; className: string }) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(onProgress);
  cb.current = onProgress;

  useEffect(() => {
    let player: YTPlayer | undefined;
    let timer: number | undefined;
    let cancelled = false;
    const report = () => {
      if (player?.getDuration?.()) cb.current?.(player.getCurrentTime(), player.getDuration());
    };
    loadYouTubeApi().then(() => {
      if (cancelled || !host.current) return;
      const el = document.createElement('div');
      host.current.replaceChildren(el);
      player = new window.YT!.Player(el, {
        videoId: id,
        width: '100%',
        height: '100%',
        playerVars: { start: Math.floor(startAt), rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            const S = window.YT!.PlayerState;
            window.clearInterval(timer);
            if (e.data === S.PLAYING) timer = window.setInterval(report, 15_000);
            if (e.data === S.PAUSED || e.data === S.ENDED) report();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      report();
      player?.destroy();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className={`${className} [&>iframe]:size-full`} />;
}
