import { useCallback, useEffect, useState } from "react";
import { cameraApi, CameraFilter } from "../api/client";
import type { Camera } from "../api/types";
import { useCameraStatusSocket } from "./useCameraStatusSocket";

export function useCameras(filter: CameraFilter) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCameras = useCallback(async () => {
    try {
      const res = await cameraApi.list(filter);
      setCameras(res.data);
      setError(null);
    } catch {
      setError("Gagal memuat daftar kamera");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter)]);

  useEffect(() => {
    setLoading(true);
    fetchCameras();
    const interval = setInterval(fetchCameras, 20_000);
    return () => clearInterval(interval);
  }, [fetchCameras]);

  // Update status realtime tanpa perlu refetch seluruh list.
  useCameraStatusSocket((event) => {
    setCameras((prev) =>
      prev.map((cam) => (cam.id === event.cameraId ? { ...cam, status: event.status } : cam))
    );
  });

  return { cameras, loading, error, refetch: fetchCameras };
}
