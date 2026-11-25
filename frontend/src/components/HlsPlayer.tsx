import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Hls from "hls.js";
import { streamApi } from "../api/client";

interface HlsPlayerProps {
  cameraId: string;
  quality: "main" | "sub";
  className?: string;
  muted?: boolean;
  onHasVideo?: (hasVideo: boolean) => void;
}

const HEARTBEAT_MS = 20_000;
const MAX_RETRY_DELAY_MS = 15_000;

/**
 * Player live stream: memakai WebRTC (WHEP) sebagai transport utama untuk latency
 * sub-detik (~200-500ms), dengan fallback otomatis ke Low-Latency HLS (hls.js)
 * jika WebRTC tidak tersedia atau ICE gagal.
 */
export const HlsPlayer = forwardRef<HTMLVideoElement, HlsPlayerProps>(function HlsPlayer(
  { cameraId, quality, className, muted = true, onHasVideo },
  forwardedRef
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [visibilityRevision, setVisibilityRevision] = useState(0);

  useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      streamApi.heartbeat(cameraId, quality).catch(() => {});

      const hls = hlsRef.current;
      const video = videoRef.current;
      if (hls && video) {
        const livePos = hls.liveSyncPosition;
        if (typeof livePos === "number" && Number.isFinite(livePos) && livePos - video.currentTime > 2) {
          video.currentTime = livePos;
        }
        video.play().catch(() => {});
        return;
      }

      if (!pcRef.current && !hlsRef.current) {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        retryCountRef.current = 0;
        setVisibilityRevision((n) => n + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [cameraId, quality]);

  useEffect(() => {
    let cancelled = false;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let whepResourceUrl: string | null = null;

    function cleanupPlayer() {
      if (pcRef.current) {
        pcRef.current.ontrack = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }
      if (whepResourceUrl) {
        fetch(whepResourceUrl, { method: "DELETE" }).catch(() => {});
        whepResourceUrl = null;
      }
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    function scheduleRetry() {
      if (cancelled) return;
      onHasVideo?.(false);
      cleanupPlayer();
      setErrorMsg("Menyambungkan ulang...");
      retryCountRef.current += 1;
      const delay = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** Math.min(retryCountRef.current, 4));
      retryTimerRef.current = setTimeout(start, delay);
    }

    function attachHls(hlsUrl: string) {
      const video = videoRef.current;
      if (!video || cancelled) return;
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
          manifestLoadingMaxRetry: 8,
          manifestLoadingRetryDelay: 500,
          levelLoadingMaxRetry: 6,
          fragLoadingMaxRetry: 6,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          retryCountRef.current = 0;
          video.play().catch(() => {});
          onHasVideo?.(true);
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            scheduleRetry();
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        video.addEventListener("error", () => scheduleRetry(), { once: true });
        video.play().catch(() => {});
        onHasVideo?.(true);
      } else {
        setErrorMsg("Browser tidak mendukung pemutaran stream");
      }
    }

    async function attachWebRtc(whepUrl: string, fallbackHlsUrl?: string) {
      const video = videoRef.current;
      if (!video || cancelled) return;
      setErrorMsg(null);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.addTransceiver("video", { direction: "recvonly" });

      let receivedTrack = false;
      pc.ontrack = (evt) => {
        if (cancelled) return;
        receivedTrack = true;
        retryCountRef.current = 0;
        video.srcObject = evt.streams[0] ?? new MediaStream([evt.track]);
        video.play().catch(() => {});
        onHasVideo?.(true);
      };

      pc.oniceconnectionstatechange = () => {
        if (cancelled || pcRef.current !== pc) return;
        const state = pc.iceConnectionState;
        if (state === "failed" || state === "closed") {
          if (!receivedTrack && fallbackHlsUrl) {
            cleanupPlayer();
            attachHls(fallbackHlsUrl);
          } else {
            scheduleRetry();
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? offer.sdp,
      });

      if (!res.ok) {
        throw new Error(`WHEP HTTP ${res.status}`);
      }

      const location = res.headers.get("Location");
      if (location) {
        whepResourceUrl = location.startsWith("http")
          ? location
          : new URL(location, window.location.origin).toString();
      }

      const answerSdp = await res.text();
      if (cancelled || pcRef.current !== pc) return;
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    }

    async function start() {
      try {
        const res = await streamApi.start(cameraId, quality);
        if (cancelled) return;
        const { url, hlsUrl } = res.data;

        heartbeatInterval = setInterval(() => {
          streamApi.heartbeat(cameraId, quality).catch(() => {});
        }, HEARTBEAT_MS);

        if (typeof RTCPeerConnection !== "undefined" && url.endsWith("/whep")) {
          try {
            await attachWebRtc(url, hlsUrl);
            return;
          } catch {
            if (cancelled) return;
            cleanupPlayer();
            if (hlsUrl) {
              attachHls(hlsUrl);
              return;
            }
          }
        } else {
          attachHls(hlsUrl ?? url);
          return;
        }

        scheduleRetry();
      } catch {
        scheduleRetry();
      }
    }

    start();

    return () => {
      cancelled = true;
      onHasVideo?.(false);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      cleanupPlayer();
    };
  }, [cameraId, quality, visibilityRevision]); // eslint-disable-line react-hooks/exhaustive-deps

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
});
