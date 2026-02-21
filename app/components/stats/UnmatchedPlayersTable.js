/**
 * UnmatchedPlayersTable Component
 * Displays Sleeper players with Opta IDs that have no corresponding FFH match
 * Includes search, sorting, and pagination functionality
 */

'use client';

import { useState } from 'react';
import PropTypes from 'prop-types';
import { getPositionBadgeDark } from '../../constants/positionColors';

// Position color utility for badge styling - now using centralized utility
const getSleeperPositionStyle = (position) => {
  return getPositionBadgeDark(position);
};

export function UnmatchedPlayersTable({ optaAnalysis }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const unmatchedPlayers = optaAnalysis?.unmatchedSleeperWithOpta || [];

  if (unmatchedPlayers.length === 0) {
    return (
      <div className={`rounded-lg shadow-sm border p-6 text-center bg-gray-800 border-gray-700`}>
        <div className="text-green-600 text-4xl mb-2">🎉</div>
        <h3 className={`text-lg font-medium mb-2 text-white`}>
          Perfect Match Rate!
        </h3>
        <p className={'text-gray-400'}>
          All Sleeper players with Opta IDs have been successfully matched to FFH players.
        </p>
      </div>
    );
  }

  // Filter players based on search term
  const filteredPlayers = unmatchedPlayers.filter(player => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const searchableText = [
      player.name || '',
      player.team || '',
      player.position || '',
      player.opta_id || ''
    ].join(' ').toLowerCase();

    return searchableText.includes(searchLower);
  });

  // Sort players
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const getValue = (player, key) => {
      switch (key) {
        case 'name': return (player.name || '').toLowerCase();
        case 'position': return player.position || '';
        case 'team': return player.team || '';
        case 'opta_id': return player.opta_id || '';
        default: return '';
      }
    };

    const aValue = getValue(a, sortConfig.key);
    const bValue = getValue(b, sortConfig.key);

    if (sortConfig.direction === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedPlayers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPlayers = sortedPlayers.slice(startIndex, endIndex);

  // Handle sort
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Render sort icon
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕️</span>;
    }
    return sortConfig.direction === 'asc' ?
      <span className="text-blue-500 ml-1">↑</span> :
      <span className="text-blue-500 ml-1">↓</span>;
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) pages.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className={`rounded-lg shadow-sm border overflow-hidden bg-gray-800 border-gray-700`}>
      {/* Header with Search and Controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className={`text-lg font-medium text-white`}>
              Unmatched Sleeper Players ({filteredPlayers.length}{searchTerm && ` of ${unmatchedPlayers.length}`})
            </h3>
            <p className={`text-sm mt-1 text-gray-400`}>
              These Sleeper players have Opta IDs but no corresponding FFH player was found.
            </p>
          </div>

          {/* Search and Items Per Page */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="w-full sm:w-64 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Items Per Page */}
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={filteredPlayers.length}>Show all ({filteredPlayers.length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className={'bg-gray-700'}>
            <tr>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Player {renderSortIcon('name')}
                </div>
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('position')}
              >
                <div className="flex items-center">
                  Position {renderSortIcon('position')}
                </div>
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('team')}
              >
                <div className="flex items-center">
                  Team {renderSortIcon('team')}
                </div>
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('opta_id')}
              >
                <div className="flex items-center">
                  Opta ID {renderSortIcon('opta_id')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${'bg-gray-800 divide-gray-700'}`}>
            {currentPlayers.length > 0 ? (
              currentPlayers.map((player, index) => (
                <tr key={`unmatched-${startIndex + index}`} className={`${'hover:bg-gray-700'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium text-white`}>
                      {player.full_name || player.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      getSleeperPositionStyle(player.position)
                    }`}>
                      {player.position || 'N/A'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                    {player.team_abbr || player.team || 'Free Agent'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400`}>
                    {player.opta_id || 'N/A'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className={`px-6 py-4 text-center text-gray-400`}>
                  {searchTerm ? `No players found matching "${searchTerm}"` : 'No unmatched players'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className={`px-6 py-3 border-t flex items-center justify-between border-gray-700 bg-gray-700`}>
          {/* Results Info */}
          <div className={`text-sm text-gray-400`}>
            Showing {startIndex + 1} to {Math.min(endIndex, sortedPlayers.length)} of {sortedPlayers.length} results
            {searchTerm && ` (filtered from ${unmatchedPlayers.length} total)`}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Previous
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                <button
                  key={index}
                  onClick={() => typeof page === 'number' && setCurrentPage(page)}
                  disabled={page === '...'}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    page === currentPage
                      ? 'bg-blue-500 text-white'
                      : page === '...'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

UnmatchedPlayersTable.propTypes = {
  optaAnalysis: PropTypes.shape({
    unmatchedSleeperWithOpta: PropTypes.arrayOf(PropTypes.shape({
      full_name: PropTypes.string,
      name: PropTypes.string,
      position: PropTypes.string,
      team: PropTypes.string,
      team_abbr: PropTypes.string,
      opta_id: PropTypes.string
    }))
  })
};
