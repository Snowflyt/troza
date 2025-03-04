import React, { useState } from "react";
import bookStore, { useBookStore } from "../stores/book";

const { addBook } = bookStore;

const AuthorSection: React.FC = () => {
  const authors = useBookStore((state) => state.authors);

  // State for new book form
  const [selectedAuthorId, setSelectedAuthorId] = useState<number | null>(null);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookPages, setNewBookPages] = useState(100);
  const [newBookYear, setNewBookYear] = useState(new Date().getFullYear());

  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAuthorId !== null && newBookTitle.trim()) {
      addBook(selectedAuthorId, newBookTitle, newBookPages, newBookYear);
      // Reset form
      setNewBookTitle("");
      setNewBookPages(100);
      setSelectedAuthorId(null);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Authors</h2>

      {/* Author List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {authors.map((author) => (
          <div key={author.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{author.name}</h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {author.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2 py-1 bg-gray-100 text-xs text-gray-700 rounded">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() =>
                  setSelectedAuthorId(selectedAuthorId === author.id ? null : author.id)
                }
                className={`px-3 py-1 text-sm rounded ${
                  selectedAuthorId === author.id ?
                    "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-gray-100 text-gray-700 border border-gray-200"
                }`}>
                {selectedAuthorId === author.id ? "Cancel" : "Add Book"}
              </button>
            </div>

            {/* Books by this author */}
            <div className="space-y-2 mt-3">
              <h4 className="font-medium text-gray-700">Books ({author.books.length}):</h4>
              <ul className="ml-4 space-y-1">
                {author.books.map((book) => (
                  <li key={book.id} className="text-gray-700">
                    <span className="font-medium">{book.title}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({book.pages} pages • {book.year} •
                      {book.inStock ?
                        <span className="text-green-600"> In Stock</span>
                      : <span className="text-red-600"> Out of Stock</span>}
                      )
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Add book form - only show for selected author */}
            {selectedAuthorId === author.id && (
              <form
                onSubmit={handleAddBook}
                className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                <h4 className="font-medium text-gray-700 mb-2">Add New Book</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newBookTitle}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                    placeholder="Book title"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newBookPages}
                      onChange={(e) => setNewBookPages(Math.max(1, parseInt(e.target.value) || 0))}
                      placeholder="Pages"
                      className="w-1/2 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      min="1"
                      required
                    />
                    <input
                      type="number"
                      value={newBookYear}
                      onChange={(e) =>
                        setNewBookYear(parseInt(e.target.value) || new Date().getFullYear())
                      }
                      placeholder="Year"
                      className="w-1/2 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      min="1"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-3 py-2 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700">
                    Add Book to {author.name}'s Collection
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthorSection;
