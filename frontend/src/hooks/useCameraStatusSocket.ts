import { useEffect } from "react";
import { io } from "socket.io-client";
import { TOKEN_KEY } from "../api/client";

export interface CameraStatusEvent {
  cameraId: string;
  status: "ONLINE" | "OFFLINE";
  at: string;
}

/** Subscribe ke event status kamera real-time (online/offline) dari backend via Socket.IO. */
export function useCameraStatusSocket(onStatus: (event: CameraStatusEvent) => void) {
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const socket = io({ path: "/socket.io", auth: { token } });
    socket.on("camera:status", onStatus);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
