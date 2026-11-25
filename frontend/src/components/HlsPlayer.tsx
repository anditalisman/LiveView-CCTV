import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { streamApi } from "../api/client";

interface HlsPlayerProps {
  cameraId: string;
  quality: "main" | "sub";
  className?: string;
  muted?: boolean;
}

const HEARTBEAT_MS = 20_000;
const MAX_RETRY_DELAY_MS = 15_000;

/**
 * Player HLS dengan auto-reconnect penuh: jika backend belum siap (ffmpeg baru start)
 * atau stream RTSP putus, komponen ini akan retry sendiri dengan backoff,
 * dan mengirim heartbeat berkala agar backend tidak mematikan proses ffmpeg karena idle.
 */
export function HlsPlayer({ cameraId, quality, className, muted = true }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        const res = await streamApi.start(cameraId, quality);
        if (cancelled) return;
        attach(res.data.url);
        heartbeatInterval = setInterval(() => {
          streamApi.heartbeat(cameraId, quality).catch(() => {});
        }, HEARTBEAT_MS);
      } catch {
        scheduleRetry();
      }
    }

    function attach(url: string) {
      const video = videoRef.current;
      if (!video) return;
      setErrorMsg(null);

      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          maxBufferLength: 3,
          maxMaxBufferLength: 6,
          backBufferLength: 0,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 3,
          maxLiveSyncPlaybackRate: 1.5,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 500,
          levelLoadingMaxRetry: 6,
          fragLoadingMaxRetry: 6,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          retryCountRef.current = 0;
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              scheduleRetry();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              scheduleRetry();
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.addEventListener("error", () => scheduleRetry(), { once: true });
        video.play().catch(() => {});
      } else {
        setErrorMsg("Browser tidak mendukung pemutaran HLS");
      }
    }

    function cleanupPlayer() {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    function scheduleRetry() {
      if (cancelled) return;
      cleanupPlayer();
      setErrorMsg("Menyambungkan ulang...");
      retryCountRef.current += 1;
      const delay = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** Math.min(retryCountRef.current, 4));
      retryTimerRef.current = setTimeout(start, delay);
    }

    function handleVisibilityChange() {
      if (document.hidden) return;
      const video = videoRef.current;
      const hls = hlsRef.current;
      if (!video || !hls) return;
      const livePos = hls.liveSyncPosition;
      if (typeof livePos === "number" && Number.isFinite(livePos) && livePos - video.currentTime > 2) {
        video.currentTime = livePos;
      }
      video.play().catch(() => {});
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    start();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      cleanupPlayer();
    };
  }, [cameraId, quality]);

  return (
    <div className={`relative bg-black ${className ?? ""}`}>
      <video ref={videoRef} muted={muted} playsInline autoPlay className="h-full w-full object-contain" />
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-gray-300">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
