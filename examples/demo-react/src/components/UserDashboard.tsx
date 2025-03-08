import React from "react";
import bookStore, { useBookStore } from "../stores/book";

const { returnBook, toggleReadingList, updateFavoriteGenres } = bookStore;

const UserDashboard: React.FC = () => {
  const { user, borrowingStats, availableGenres } = useBookStore();

  // Filter books to get the ones borrowed by user and in reading list
  // Dependencies are also automatically tracked here to avoid unnecessary rerenders
  const [borrowedBookObjects, readingListObjects] = useBookStore((state) => [
    state.allBooks.filter((book) => state.user.borrowedBooks.includes(book.id)),
    state.allBooks.filter((book) => state.user.readingList.includes(book.id)),
  ]);

  const getAuthorForBook = (bookId: number) => {
    const authors = bookStore.$get().authors;
    return (
      authors.find((author) => author.books.some((book) => book.id === bookId))?.name || "Unknown"
    );
  };

  // Toggle favorite genres
  const toggleFavoriteGenre = (genre: string) => {
    const updatedFavorites =
      user.favoriteGenres.includes(genre) ?
        user.favoriteGenres.filter((g) => g !== genre)
      : [...user.favoriteGenres, genre];

    updateFavoriteGenres(updatedFavorites);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-5 shadow">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Hello, {user.name}</h2>
          <div className="rounded bg-indigo-50 px-4 py-2 text-indigo-700">User ID: {user.id}</div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
            <span className="block text-3xl font-bold text-indigo-600">
              {borrowingStats.borrowedCount}
            </span>
            <span className="text-gray-600">Borrowed Books</span>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
            <span className="block text-3xl font-bold text-amber-600">
              {borrowingStats.readingListCount}
            </span>
            <span className="text-gray-600">Reading List</span>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
            <span className="block text-3xl font-bold text-gray-700">
              {borrowingStats.totalCount}
            </span>
            <span className="text-gray-600">Total Books</span>
          </div>
        </div>

        {/* Favorite Genres */}
        <div className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Favorite Genres</h3>
          <div className="flex flex-wrap gap-2">
            {availableGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleFavoriteGenre(genre)}
                className={`rounded px-3 py-1 text-sm ${
                  user.favoriteGenres.includes(genre) ?
                    "border border-indigo-300 bg-indigo-100 text-indigo-700"
                  : "border border-gray-300 bg-gray-100 text-gray-700"
                }`}>
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Book Lists */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Borrowed Books */}
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Borrowed Books</h3>

          {borrowedBookObjects.length === 0 ?
            <p className="text-gray-500 italic">You haven't borrowed any books yet.</p>
          : <ul className="divide-y divide-gray-200">
              {borrowedBookObjects.map((book) => (
                <li key={book.id} className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="font-medium text-gray-800">{book.title}</h4>
                    <p className="text-sm text-gray-600">By {getAuthorForBook(book.id)}</p>
                  </div>
                  <button
                    onClick={() => returnBook(book.id)}
                    className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100">
                    Return
                  </button>
                </li>
              ))}
            </ul>
          }
        </div>

        {/* Reading List */}
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Reading List</h3>

          {readingListObjects.length === 0 ?
            <p className="text-gray-500 italic">Your reading list is empty.</p>
          : <ul className="divide-y divide-gray-200">
              {readingListObjects.map((book) => (
                <li key={book.id} className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="font-medium text-gray-800">{book.title}</h4>
                    <p className="text-sm text-gray-600">By {getAuthorForBook(book.id)}</p>
                  </div>
                  <button
                    onClick={() => toggleReadingList(book.id)}
                    className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700 hover:bg-amber-100">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          }
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
