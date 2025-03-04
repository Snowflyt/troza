import React from "react";
import bookStore, { useBookStore } from "../stores/book";

const { setSearchTerm, toggleGenreFilter, setYearRange } = bookStore;

const BookFilters: React.FC = () => {
  // Selectors are memoized depending on their dependencies, so you can
  // directly select multiple states without worrying about unnecessary rerenders
  const { filters, availableGenres } = useBookStore((state) => ({
    filters: state.filters,
    availableGenres: state.availableGenres,
  }));

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">Filter Books</h2>

      <div className="space-y-4">
        {/* Search */}
        <div>
          <label htmlFor="search" className="mb-1 block text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={filters.searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title..."
            className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Year Range Slider */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Year Range</label>
            <span className="text-xs text-gray-500">
              {filters.yearRange.min} - {filters.yearRange.max}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                value={filters.yearRange.min}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value <= filters.yearRange.max)
                    setYearRange(value, filters.yearRange.max);
                }}
                min={1800}
                max={filters.yearRange.max}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <label className="mt-1 block text-xs text-gray-500">Min Year</label>
            </div>
            <div>
              <input
                type="number"
                value={filters.yearRange.max}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= filters.yearRange.min)
                    setYearRange(filters.yearRange.min, value);
                }}
                min={filters.yearRange.min}
                max={new Date().getFullYear()}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <label className="mt-1 block text-xs text-gray-500">Max Year</label>
            </div>
          </div>
        </div>

        {/* Genres */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700">Genres</span>
          <div className="flex flex-wrap gap-2">
            {availableGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenreFilter(genre)}
                className={`rounded px-3 py-1 text-sm ${
                  filters.selectedGenres.includes(genre) ?
                    "border border-indigo-300 bg-indigo-100 text-indigo-800"
                  : "border border-gray-300 bg-gray-100 text-gray-800"
                }`}>
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Stock filter */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="stockFilter"
            checked={filters.onlyShowInStock}
            onChange={() => {
              bookStore.$update((draft) => {
                draft.filters.onlyShowInStock = !filters.onlyShowInStock;
              });
            }}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="stockFilter" className="ml-2 text-sm text-gray-700">
            Only show in-stock books
          </label>
        </div>
      </div>
    </div>
  );
};

export default BookFilters;
