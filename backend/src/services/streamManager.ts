import { Camera, Device } from "@prisma/client";
import { env } from "../config/env";
import { buildRtspUrl, maskRtspUrl, StreamQuality } from "../utils/rtsp";

interface StreamUrls {
  url: string;
  hlsUrl: string;
}

const activePaths = new Map<string, number>();

export function pathNameFor(cameraId: string, quality: StreamQuality): string {
  return `${cameraId}_${quality}`;
}

export function publicWebRtcPath(cameraId: string, quality: StreamQuality): string {
  return `/webrtc/${pathNameFor(cameraId, quality)}/whep`;
}

export function publicHlsPath(cameraId: string, quality: StreamQuality): string {
  return `/hls/${pathNameFor(cameraId, quality)}/index.m3u8`;
}

async function mediamtxRequest(method: string, apiPath: string, body?: unknown): Promise<Response> {
  const url = `${env.mediamtxApiUrl}${apiPath}`;
  return fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * Daftarkan atau perbarui path RTSP di MediaMTX dengan mode on-demand.
 * MediaMTX otomatis menarik RTSP saat ada viewer WebRTC/HLS dan memutusnya
 * setelah idle timeout tanpa menulis segmen .ts ke disk.
 */
export async function ensureStream(
  device: Device,
  camera: Camera,
  quality: StreamQuality
): Promise<StreamUrls> {
  const name = pathNameFor(camera.id, quality);
  const rtspUrl = buildRtspUrl(device, camera, quality);
  const transport = device.transport === "udp" ? "udp" : "tcp";
  const closeAfter = `${env.streamIdleTimeoutSec}s`;

  const payload = {
    source: rtspUrl,
    rtspTransport: transport,
    sourceOnDemand: true,
    sourceOnDemandStartTimeout: "10s",
    sourceOnDemandCloseAfter: closeAfter,
  };

  // Coba tambah path baru; jika sudah ada (400/409), patch konfigurasinya.
  const addRes = await mediamtxRequest("POST", `/v3/config/paths/add/${name}`, payload);
  if (!addRes.ok) {
    const patchRes = await mediamtxRequest("PATCH", `/v3/config/paths/patch/${name}`, payload);
    if (!patchRes.ok) {
      const text = await patchRes.text().catch(() => "");
      throw new Error(
        `Gagal mendaftarkan stream ${name} (${maskRtspUrl(rtspUrl)}) ke MediaMTX: HTTP ${patchRes.status} ${text}`
      );
    }
  }

  activePaths.set(name, Date.now());
  return {
    url: publicWebRtcPath(camera.id, quality),
    hlsUrl: publicHlsPath(camera.id, quality),
  };
}

export function heartbeat(cameraId: string, quality: StreamQuality) {
  const name = pathNameFor(cameraId, quality);
  if (activePaths.has(name)) {
    activePaths.set(name, Date.now());
  }
}

export async function stopStream(cameraId: string, quality: StreamQuality) {
  const name = pathNameFor(cameraId, quality);
  activePaths.delete(name);
  try {
    await mediamtxRequest("DELETE", `/v3/config/paths/delete/${name}`);
  } catch {
    // Abaikan jika path memang belum terdaftar atau MediaMTX sedang restart.
  }
}

export async function stopCameraStreams(cameraId: string) {
  await Promise.all([stopStream(cameraId, "main"), stopStream(cameraId, "sub")]);
}

/**
 * MediaMTX sudah menangani idle close via `sourceOnDemandCloseAfter`.
 * Sweeper ini hanya membersihkan tracking in-memory agar tidak menumpuk.
 */
export function startIdleSweeper() {
  setInterval(() => {
    const now = Date.now();
    const ttlMs = env.streamIdleTimeoutSec * 2 * 1000;
    for (const [name, lastSeen] of activePaths) {
      if (now - lastSeen > ttlMs) {
        activePaths.delete(name);
      }
    }
  }, 30_000);
}

export function getActiveStreamCount() {
  return activePaths.size;
}
