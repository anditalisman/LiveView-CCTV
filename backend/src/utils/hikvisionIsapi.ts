import { XMLParser } from "fast-xml-parser";
import { Device } from "@prisma/client";
import { digestAuthGet } from "./digestAuth";
import { decryptSecret } from "./crypto";

export interface DiscoveredChannel {
  channelNo: number;
  name: string;
}

const parser = new XMLParser({ ignoreAttributes: true });

/**
 * Ambil daftar channel dari NVR/DVR/IP Camera Hikvision lewat ISAPI.
 * Dicoba berurutan karena firmware berbeda-beda dukungannya:
 *  1. /ISAPI/ContentMgmt/InputProxy/channels — kamera IP yang didaftarkan
 *     sebagai "proxy channel" ke NVR (paling umum untuk NVR modern yang
 *     menerima kamera IP, bukan input analog BNC).
 *  2. /ISAPI/System/Video/inputs/channels — input video analog asli
 *     (DVR/NVR dengan port BNC), atau IP Camera berdiri sendiri.
 */
export async function discoverVideoInputChannels(device: Device): Promise<DiscoveredChannel[]> {
  const password = decryptSecret(device.rtspPasswordEnc);
  const base = `http://${device.ipAddress}:${device.httpPort}`;

  const proxyChannels = await tryFetchChannels(
    `${base}/ISAPI/ContentMgmt/InputProxy/channels`,
    device.rtspUsername,
    password,
    "InputProxyChannelList",
    "InputProxyChannel"
  );
  if (proxyChannels) return proxyChannels;

  const analogChannels = await tryFetchChannels(
    `${base}/ISAPI/System/Video/inputs/channels`,
    device.rtspUsername,
    password,
    "VideoInputChannelList",
    "VideoInputChannel"
  );
  if (analogChannels) return analogChannels;

  throw new Error(
    "NVR tidak mendukung endpoint deteksi channel yang dikenal (InputProxy maupun VideoInput). " +
      "Tambahkan kamera secara manual lewat menu Kamera."
  );
}

/** Return null (bukan throw) kalau endpoint ini tidak didukung firmware, supaya bisa coba endpoint lain. */
async function tryFetchChannels(
  url: string,
  username: string,
  password: string,
  listKey: string,
  itemKey: string
): Promise<DiscoveredChannel[] | null> {
  const { status, body } = await digestAuthGet(url, username, password);

  if (status === 401) {
    throw new Error("Autentikasi ISAPI gagal. Periksa username/password device.");
  }
  if (status >= 400) return null;

  let parsed: any;
  try {
    parsed = parser.parse(body);
  } catch {
    return null;
  }

  const list = parsed?.[listKey]?.[itemKey];
  if (!list) return null;

  const items = Array.isArray(list) ? list : [list];
  const channels = items
    .map((ch) => ({
      channelNo: Number(ch.id),
      name: typeof ch.name === "string" && ch.name.trim() ? ch.name.trim() : `Channel ${ch.id}`,
    }))
    .filter((ch) => Number.isFinite(ch.channelNo))
    .sort((a, b) => a.channelNo - b.channelNo);

  return channels.length > 0 ? channels : null;
}
