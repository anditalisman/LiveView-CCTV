import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Camera, Device } from "@prisma/client";
import { env } from "../config/env";
import { buildRtspUrl, maskRtspUrl, StreamQuality } from "../utils/rtsp";

interface RunningStream {
  cameraId: string;
  quality: StreamQuality;
  process: ChildProcess;
  outputDir: string;
  lastHeartbeatAt: number;
  restartAttempts: number;
  stopping: boolean;
}

const streams = new Map<string, RunningStream>();

function streamKey(cameraId: string, quality: StreamQuality) {
  return `${cameraId}:${quality}`;
}

function outputDirFor(cameraId: string, quality: StreamQuality) {
  return path.join(env.hlsOutputDir, cameraId, quality);
}

export function publicHlsPath(cameraId: string, quality: StreamQuality) {
  return `/streams/${cameraId}/${quality}/index.m3u8`;
}

function spawnFfmpeg(rtspUrl: string, transport: string, outputDir: string) {
  const playlistPath = path.join(outputDir, "index.m3u8");
  const segmentPath = path.join(outputDir, "seg_%05d.ts");

  const args = [
    "-rtsp_transport",
    transport,
    "-i",
    rtspUrl,
    "-an", // tanpa audio: cukup untuk monitoring CCTV, hemat bandwidth & CPU
    "-c:v",
    "copy", // tidak transcode -> ringan di CPU server. Ganti ke libx264 jika kamera H.265.
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_list_size",
    "6",
    "-hls_flags",
    "delete_segments+independent_segments",
    "-hls_segment_filename",
    segmentPath,
    playlistPath,
  ];

  return spawn(env.ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
}

function startProcess(
  cameraId: string,
  quality: StreamQuality,
  device: Device,
  camera: Camera
): RunningStream {
  const outputDir = outputDirFor(cameraId, quality);
  fs.mkdirSync(outputDir, { recursive: true });

  const rtspUrl = buildRtspUrl(device, camera, quality);
  const proc = spawnFfmpeg(rtspUrl, device.transport, outputDir);

  const entry: RunningStream = {
    cameraId,
    quality,
    process: proc,
    outputDir,
    lastHeartbeatAt: Date.now(),
    restartAttempts: 0,
    stopping: false,
  };

  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (/error|fail/i.test(text)) {
      console.warn(`[ffmpeg ${cameraId}:${quality}] ${text.trim()}`);
    }
  });

  proc.on("exit", (code) => {
    const key = streamKey(cameraId, quality);
    const current = streams.get(key);
    if (!current || current.stopping) {
      streams.delete(key);
      return;
    }

    const idleMs = Date.now() - current.lastHeartbeatAt;
    const isStillWanted = idleMs < env.streamIdleTimeoutSec * 1000;

    if (!isStillWanted) {
      console.log(`[stream ${cameraId}:${quality}] tidak ada viewer, stream dihentikan.`);
      streams.delete(key);
      return;
    }

    // Auto-reconnect dengan exponential backoff jika RTSP terputus mendadak.
    current.restartAttempts += 1;
    const backoffMs = Math.min(30000, 1000 * 2 ** Math.min(current.restartAttempts, 5));
    console.warn(
      `[stream ${cameraId}:${quality}] ffmpeg exit code=${code}. Reconnect dalam ${backoffMs}ms (attempt #${current.restartAttempts}) -> ${maskRtspUrl(
        buildRtspUrl(device, camera, quality)
      )}`
    );

    setTimeout(() => {
      const stillTracked = streams.get(key);
      if (!stillTracked || stillTracked.stopping) return;
      const restarted = startProcess(cameraId, quality, device, camera);
      restarted.restartAttempts = current.restartAttempts;
      restarted.lastHeartbeatAt = current.lastHeartbeatAt;
      streams.set(key, restarted);
    }, backoffMs);
  });

  return entry;
}

/**
 * Pastikan stream HLS untuk camera+quality berjalan, lalu kembalikan path publiknya.
 * Dipanggil saat pertama kali tile dibuka atau saat heartbeat dari frontend.
 */
export function ensureStream(device: Device, camera: Camera, quality: StreamQuality): string {
  const key = streamKey(camera.id, quality);
  const existing = streams.get(key);

  if (existing) {
    existing.lastHeartbeatAt = Date.now();
    return publicHlsPath(camera.id, quality);
  }

  const entry = startProcess(camera.id, quality, device, camera);
  streams.set(key, entry);
  return publicHlsPath(camera.id, quality);
}

export function heartbeat(cameraId: string, quality: StreamQuality) {
  const entry = streams.get(streamKey(cameraId, quality));
  if (entry) entry.lastHeartbeatAt = Date.now();
}

function stopEntry(entry: RunningStream) {
  entry.stopping = true;
  entry.process.kill("SIGTERM");
  fs.rm(entry.outputDir, { recursive: true, force: true }, () => {});
}

export function stopStream(cameraId: string, quality: StreamQuality) {
  const key = streamKey(cameraId, quality);
  const entry = streams.get(key);
  if (!entry) return;
  stopEntry(entry);
  streams.delete(key);
}

export function stopCameraStreams(cameraId: string) {
  stopStream(cameraId, "main");
  stopStream(cameraId, "sub");
}

/** Background sweeper: hentikan stream yang sudah tidak ada viewer (idle) untuk hemat CPU/bandwidth. */
export function startIdleSweeper() {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of streams) {
      if (entry.stopping) continue;
      const idleMs = now - entry.lastHeartbeatAt;
      if (idleMs > env.streamIdleTimeoutSec * 1000) {
        console.log(`[stream ${key}] idle ${Math.round(idleMs / 1000)}s, menghentikan ffmpeg.`);
        stopEntry(entry);
        streams.delete(key);
      }
    }
  }, 10_000);
}

export function getActiveStreamCount() {
  return streams.size;
}
