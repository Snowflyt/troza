import React from "react";
import bookStore, { useBookStore } from "../stores/book";

const { borrowBook, toggleReadingList } = bookStore;

const RecommendationPanel: React.FC = () => {
  // You can use an optional Zustand-like selector if you prefer
  // specifying dependencies manually rather than automatically
  const [recommendedBooks, favoriteGenres, readingList] = useBookStore((state) => [
    state.recommendedBooks,
    state.user.favoriteGenres,
    state.user.readingList,
  ]);

  // Find the author for a book
  const getAuthorForBook = (bookId: number) => {
    const authors = bookStore.$get().authors;
    return (
      authors.find((author) => author.books.some((book) => book.id === bookId))?.name || "Unknown"
    );
  };

  if (recommendedBooks.length === 0) return null;

  return (
    <div className="rounded-lg bg-gradient-to-r from-amber-50 to-amber-100 p-4 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-amber-900">Recommended for You</h2>
        <div className="flex gap-1">
          {favoriteGenres.map((genre) => (
            <span key={genre} className="rounded bg-amber-200 px-2 py-1 text-xs text-amber-800">
              {genre}
            </span>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm text-amber-800">Based on your favorite genres</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {recommendedBooks.map((book) => (
          <div key={book.id} className="rounded border border-amber-200 bg-white p-3">
            <h3 className="font-medium text-amber-800">{book.title}</h3>
            <p className="text-xs text-gray-600">By {getAuthorForBook(book.id)}</p>
            <p className="text-xs text-gray-500">
              {book.pages} pages • {book.year}
            </p>

            <div className="mt-2 flex gap-2">
              {book.inStock && (
                <button
                  onClick={() => borrowBook(book.id)}
                  className="rounded border border-amber-200 bg-amber-100 px-2 py-1 text-xs text-amber-800 hover:bg-amber-200">
                  Borrow
                </button>
              )}
              <button
                onClick={() => toggleReadingList(book.id)}
                className={`rounded px-2 py-1 text-xs ${
                  readingList.includes(book.id) ?
                    "border border-gray-200 bg-gray-100 text-gray-800"
                  : "border border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200"
                }`}>
                {readingList.includes(book.id) ? "In Reading List" : "Add to Reading List"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationPanel;
