export type Role = "ADMIN" | "OPERATOR";
export type DeviceType = "IP_CAMERA" | "NVR";
export type CameraStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  brand: string;
  ipAddress: string;
  port: number;
  httpPort: number;
  rtspUsername: string;
  transport: "tcp" | "udp";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { cameras: number };
}

export interface DiscoverChannelsResult {
  discovered: number;
  created: number;
  skipped: number;
  cameras: Camera[];
}

export interface Camera {
  id: string;
  deviceId: string;
  device: {
    id: string;
    name: string;
    type: DeviceType;
    brand: string;
    ipAddress: string;
    transport: "tcp" | "udp";
  };
  name: string;
  location: string;
  channelNo: number;
  mainStreamSuffix: number;
  subStreamSuffix: number;
  isActive: boolean;
  status: CameraStatus;
  lastCheckedAt: string | null;
  lastOnlineAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  rtspUrl: string;
  latencyMs: number;
  streamInfo?: {
    codec_name?: string;
    width?: number;
    height?: number;
  } | null;
}
