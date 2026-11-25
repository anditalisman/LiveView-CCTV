import axios from "axios";
import type { Camera, Device, DiscoverChannelsResult, TestConnectionResult, User } from "./types";

export const TOKEN_KEY = "liveview_token";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: User }>("/auth/login", { username, password }),
  me: () => api.get<User>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/auth/change-password", { currentPassword, newPassword }),
};

// ---- Users ----
export const userApi = {
  list: () => api.get<User[]>("/users"),
  create: (data: { username: string; password: string; fullName: string; role: string }) =>
    api.post<User>("/users", data),
  update: (id: string, data: Partial<{ fullName: string; role: string; isActive: boolean; password: string }>) =>
    api.patch<User>(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

// ---- Devices ----
export interface DevicePayload {
  name: string;
  type: "IP_CAMERA" | "NVR";
  brand?: string;
  ipAddress: string;
  port?: number;
  httpPort?: number;
  rtspUsername: string;
  rtspPassword?: string;
  transport?: "tcp" | "udp";
  notes?: string;
}

export const deviceApi = {
  list: () => api.get<Device[]>("/devices"),
  get: (id: string) => api.get<Device>(`/devices/${id}`),
  create: (data: DevicePayload) => api.post<Device>("/devices", data),
  update: (id: string, data: Partial<DevicePayload>) => api.patch<Device>(`/devices/${id}`, data),
  remove: (id: string) => api.delete(`/devices/${id}`),
  discoverChannels: (id: string) =>
    api.post<DiscoverChannelsResult>(`/devices/${id}/discover-channels`),
};

// ---- Cameras ----
export interface CameraFilter {
  search?: string;
  location?: string;
  status?: string;
  isActive?: string;
}

export interface CameraPayload {
  deviceId: string;
  name: string;
  location: string;
  channelNo: number;
  mainStreamSuffix: number;
  subStreamSuffix: number;
  isActive?: boolean;
  sortOrder?: number;
}

export const cameraApi = {
  list: (filter: CameraFilter = {}) => api.get<Camera[]>("/cameras", { params: filter }),
  locations: () => api.get<string[]>("/cameras/locations"),
  get: (id: string) => api.get<Camera>(`/cameras/${id}`),
  create: (data: CameraPayload) => api.post<Camera>("/cameras", data),
  update: (id: string, data: Partial<CameraPayload>) => api.patch<Camera>(`/cameras/${id}`, data),
  toggleActive: (id: string) => api.patch<Camera>(`/cameras/${id}/toggle-active`),
  remove: (id: string) => api.delete(`/cameras/${id}`),
  testConnection: (id: string) => api.post<TestConnectionResult>(`/cameras/${id}/test-connection`),
};

// ---- Streams ----
export const streamApi = {
  start: (cameraId: string, quality: "main" | "sub") =>
    api.post<{ url: string; hlsUrl?: string }>(`/streams/${cameraId}/${quality}/start`),
  heartbeat: (cameraId: string, quality: "main" | "sub") =>
    api.post(`/streams/${cameraId}/${quality}/heartbeat`),
};
