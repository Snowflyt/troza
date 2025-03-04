import React from "react";
import bookStore, { useBookStore } from "../stores/book";

const { setActiveLocation } = bookStore;

const LibraryHeader: React.FC = () => {
  const library = useBookStore((state) => state.library);

  return (
    <div className="flex items-center justify-center gap-4">
      <h2 className="text-xl font-medium text-gray-800">{library.name}</h2>
      <div className="flex items-center">
        <span className="text-gray-600 mr-2">Location:</span>
        <select
          value={library.activeLocation}
          onChange={(e) => setActiveLocation(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {library.locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default LibraryHeader;
