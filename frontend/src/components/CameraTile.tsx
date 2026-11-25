import { useEffect, useRef, useState } from "react";
import type { Camera } from "../api/types";
import { HlsPlayer } from "./HlsPlayer";
import { StatusBadge } from "./StatusBadge";

export function CameraTile({ camera }: { camera: Camera }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceHd, setForceHd] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  const offline = camera.status === "OFFLINE";
  const activeQuality = isFullscreen || forceHd ? "main" : "sub";

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-lg border border-gray-800 bg-[#11161d]"
    >
      {/* Main/sub stream: sub dipakai di grid (hemat bandwidth), main otomatis saat fullscreen atau HD aktif */}
      <HlsPlayer cameraId={camera.id} quality={activeQuality} className="h-full w-full" />

      {offline && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-gray-400">
          Kamera offline
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{camera.name}</div>
          <div className="truncate text-xs text-gray-300">{camera.location}</div>
        </div>
        <StatusBadge status={camera.status} />
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={() => setForceHd((v) => !v)}
          title={activeQuality === "main" ? "Kualitas HD (Main Stream)" : "Kualitas SD (Sub Stream) — klik untuk HD"}
          className={`rounded-md px-2 py-1 text-[11px] font-bold transition ${
            activeQuality === "main"
              ? "bg-blue-600 text-white hover:bg-blue-500"
              : "bg-black/60 text-gray-200 hover:bg-black/80"
          }`}
        >
          HD
        </button>

        <button
          onClick={toggleFullscreen}
          title="Fullscreen"
          className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
        >
        {isFullscreen ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M9 9H5V7h2V5h2v4zm6 0V5h2v2h2v2h-4zm-6 6v4H7v-2H5v-2h4zm6 0h4v2h-2v2h-2v-4z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M7 5h4v2H7v4H5V5h2zm10 0h2v6h-2V7h-4V5h4zM7 19H5v-6h2v4h4v2H7zm10 0h-4v-2h4v-4h2v6h-2z" />
          </svg>
        )}
        </button>
      </div>
    </div>
  );
}
