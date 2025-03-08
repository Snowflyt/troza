import React from "react";
import bookStore, { useBookStore } from "../stores/book";

const { borrowBook, returnBook, toggleReadingList } = bookStore;

const BookList: React.FC = () => {
  // You can use an optional Zustand-like selector if you prefer
  // specifying dependencies manually rather than automatically
  const [filteredBooks, borrowedBooks, readingList] = useBookStore((state) => [
    state.filteredBooks,
    state.user.borrowedBooks,
    state.user.readingList,
  ]);

  // Find the author for a book
  const getAuthorForBook = (bookId: number) => {
    const authors = bookStore.$get().authors;
    return (
      authors.find((author) => author.books.some((book) => book.id === bookId))?.name || "Unknown"
    );
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-4 text-xl font-semibold text-gray-800">Books</h2>

      {filteredBooks.length === 0 ?
        <p className="text-gray-500 italic">No books match your filters.</p>
      : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredBooks.map((book) => (
            <div key={book.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-800">{book.title}</h3>
                  <p className="text-sm text-gray-600">By {getAuthorForBook(book.id)}</p>
                  <p className="text-sm text-gray-500">
                    {book.pages} pages • {book.year}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs ${
                    book.inStock ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                  {book.inStock ? "In Stock" : "Out of Stock"}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                {borrowedBooks.includes(book.id) ?
                  <button
                    onClick={() => returnBook(book.id)}
                    className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100">
                    Return Book
                  </button>
                : book.inStock ?
                  <button
                    onClick={() => borrowBook(book.id)}
                    className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100">
                    Borrow
                  </button>
                : null}

                <button
                  onClick={() => toggleReadingList(book.id)}
                  className={`rounded px-3 py-1 text-sm ${
                    readingList.includes(book.id) ?
                      "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}>
                  {readingList.includes(book.id) ? "Remove from List" : "Add to Reading List"}
                </button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
};

export default BookList;
