interface SearchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  locations: string[];
  gridSize: number | "auto";
  onGridSizeChange: (value: number | "auto") => void;
}

export function SearchFilterBar({
  search,
  onSearchChange,
  location,
  onLocationChange,
  status,
  onStatusChange,
  locations,
  gridSize,
  onGridSizeChange,
}: SearchFilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Cari nama atau lokasi kamera..."
        className="min-w-[220px] flex-1 rounded-md border border-gray-700 bg-[#11161d] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />

      <select
        value={location}
        onChange={(e) => onLocationChange(e.target.value)}
        className="rounded-md border border-gray-700 bg-[#11161d] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">Semua Lokasi</option>
        {locations.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-md border border-gray-700 bg-[#11161d] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">Semua Status</option>
        <option value="ONLINE">Online</option>
        <option value="OFFLINE">Offline</option>
      </select>

      <select
        value={gridSize}
        onChange={(e) => onGridSizeChange(e.target.value === "auto" ? "auto" : Number(e.target.value))}
        className="rounded-md border border-gray-700 bg-[#11161d] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        title="Jumlah kamera per halaman"
      >
        <option value="auto">Grid Otomatis</option>
        <option value={1}>1x1</option>
        <option value={4}>2x2</option>
        <option value={9}>3x3</option>
        <option value={16}>4x4</option>
      </select>
    </div>
  );
}
