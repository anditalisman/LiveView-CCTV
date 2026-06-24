import { useEffect, useMemo, useState } from "react";
import { cameraApi } from "../api/client";
import { CameraTile } from "../components/CameraTile";
import { Pagination } from "../components/Pagination";
import { SearchFilterBar } from "../components/SearchFilterBar";
import { useCameras } from "../hooks/useCameras";

const DEFAULT_PAGE_SIZE = 16; // 4x4, sesuai batas grid maksimum sebelum pagination

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [gridSize, setGridSize] = useState<number | "auto">("auto");
  const [page, setPage] = useState(1);
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    cameraApi.locations().then((res) => setLocations(res.data));
  }, []);

  const { cameras, loading, error } = useCameras({
    search: search || undefined,
    location: location || undefined,
    status: status || undefined,
    isActive: "true",
  });

  useEffect(() => setPage(1), [search, location, status, gridSize]);

  const pageSize = gridSize === "auto" ? DEFAULT_PAGE_SIZE : gridSize;
  const totalPages = Math.max(1, Math.ceil(cameras.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageCameras = useMemo(
    () => cameras.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [cameras, currentPage, pageSize]
  );

  // Kolom grid otomatis: 1->1x1, 4->2x2, 9->3x3, 16->4x4, dst.
  const columns = Math.max(1, Math.ceil(Math.sqrt(pageCameras.length)));

  return (
    <div>
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        location={location}
        onLocationChange={setLocation}
        status={status}
        onStatusChange={setStatus}
        locations={locations}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
      />

      {loading && <div className="py-10 text-center text-gray-500">Memuat kamera...</div>}
      {error && <div className="py-10 text-center text-red-400">{error}</div>}

      {!loading && !error && pageCameras.length === 0 && (
        <div className="py-10 text-center text-gray-500">
          Tidak ada kamera yang cocok dengan filter saat ini.
        </div>
      )}

      {!loading && pageCameras.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {pageCameras.map((camera) => (
            <CameraTile key={camera.id} camera={camera} />
          ))}
        </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />

      <div className="mt-3 text-center text-xs text-gray-600">
        Menampilkan {pageCameras.length} dari {cameras.length} kamera
      </div>
    </div>
  );
}
