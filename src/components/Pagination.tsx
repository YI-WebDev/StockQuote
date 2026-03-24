import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/60 px-5 py-3">
      {/* Mobile: prev/next only */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          前へ
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          全 <span className="font-semibold text-gray-700 dark:text-gray-300">{totalItems}</span> 件中{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{startItem}</span>〜<span className="font-semibold text-gray-700 dark:text-gray-300">{endItem}</span> 件を表示
        </p>
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="sr-only">前へ</span>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            const show =
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1);

            if (show) {
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  aria-current={currentPage === page ? 'page' : undefined}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              );
            }

            if (
              (page === 2 && currentPage > 3) ||
              (page === totalPages - 1 && currentPage < totalPages - 2)
            ) {
              return (
                <span key={page} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                  …
                </span>
              );
            }

            return null;
          })}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="sr-only">次へ</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
