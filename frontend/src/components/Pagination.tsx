interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-40 hover:bg-gray-800"
      >
        Sebelumnya
      </button>
      <span className="text-sm text-gray-400">
        Halaman {page} dari {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-40 hover:bg-gray-800"
      >
        Selanjutnya
      </button>
    </div>
  );
}
