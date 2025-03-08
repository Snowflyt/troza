import React, { useState } from "react";
import bookStore, { useBookStore } from "../stores/book";

const { addBook } = bookStore;

const AuthorSection: React.FC = () => {
  const { authors } = useBookStore();

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
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Authors</h2>

      {/* Author List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {authors.map((author) => (
          <div key={author.id} className="rounded-lg bg-white p-4 shadow">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{author.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {author.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() =>
                  setSelectedAuthorId(selectedAuthorId === author.id ? null : author.id)
                }
                className={`rounded px-3 py-1 text-sm ${
                  selectedAuthorId === author.id ?
                    "border border-indigo-200 bg-indigo-100 text-indigo-700"
                  : "border border-gray-200 bg-gray-100 text-gray-700"
                }`}>
                {selectedAuthorId === author.id ? "Cancel" : "Add Book"}
              </button>
            </div>

            {/* Books by this author */}
            <div className="mt-3 space-y-2">
              <h4 className="font-medium text-gray-700">Books ({author.books.length}):</h4>
              <ul className="ml-4 space-y-1">
                {author.books.map((book) => (
                  <li key={book.id} className="text-gray-700">
                    <span className="font-medium">{book.title}</span>
                    <span className="ml-2 text-sm text-gray-500">
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
                className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
                <h4 className="mb-2 font-medium text-gray-700">Add New Book</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newBookTitle}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                    placeholder="Book title"
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newBookPages}
                      onChange={(e) => setNewBookPages(Math.max(1, parseInt(e.target.value) || 0))}
                      placeholder="Pages"
                      className="w-1/2 rounded border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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
                      className="w-1/2 rounded border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      min="1"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700">
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
