'use client';
import { useState, useMemo } from 'react';

export const VirtualizedPlayerGrid = ({ players, renderPlayer, itemsPerPage = 50 }) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const paginatedPlayers = useMemo(() => {
    const startIndex = currentPage * itemsPerPage;
    return players.slice(startIndex, startIndex + itemsPerPage);
  }, [players, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(players.length / itemsPerPage);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedPlayers.map(renderPlayer)}
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          
          <span className="px-4 py-1">
            Page {currentPage + 1} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};