import { Camera, Device } from "@prisma/client";
import { decryptSecret } from "./crypto";

export type StreamQuality = "main" | "sub";

/**
 * Bangun URL RTSP Hikvision dari device + camera.
 * Format: rtsp://user:pass@ip:port/Streaming/Channels/{suffix}
 * - quality "sub"  -> dipakai untuk grid dashboard (hemat bandwidth)
 * - quality "main" -> dipakai saat fullscreen
 */
export function buildRtspUrl(device: Device, camera: Camera, quality: StreamQuality): string {
  const password = decryptSecret(device.rtspPasswordEnc);
  const user = encodeURIComponent(device.rtspUsername);
  const pass = encodeURIComponent(password);
  const suffix = quality === "main" ? camera.mainStreamSuffix : camera.subStreamSuffix;
  return `rtsp://${user}:${pass}@${device.ipAddress}:${device.port}/Streaming/Channels/${suffix}`;
}

/** Versi RTSP URL yang aman untuk log (password disensor). */
export function maskRtspUrl(url: string): string {
  return url.replace(/(rtsp:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}
