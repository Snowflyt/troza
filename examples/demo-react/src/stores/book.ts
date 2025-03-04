import { createStore } from "troza";
import { hookify } from "troza/react";

const bookStore = createStore({
  library: {
    name: "City Central Library",
    locations: ["Main Branch", "North Wing", "South Wing"],
    activeLocation: "Main Branch",
  },

  authors: [
    {
      id: 1,
      name: "Jane Austen",
      genres: ["Classic", "Romance"],
      books: [
        { id: 101, title: "Pride and Prejudice", pages: 432, year: 1813, inStock: true },
        { id: 102, title: "Emma", pages: 378, year: 1815, inStock: true },
        { id: 103, title: "Sense and Sensibility", pages: 352, year: 1811, inStock: false },
      ],
    },
    {
      id: 2,
      name: "George Orwell",
      genres: ["Dystopian", "Political Fiction"],
      books: [
        { id: 201, title: "1984", pages: 328, year: 1949, inStock: true },
        { id: 202, title: "Animal Farm", pages: 112, year: 1945, inStock: false },
      ],
    },
    {
      id: 3,
      name: "J.K. Rowling",
      genres: ["Fantasy", "Young Adult"],
      books: [
        {
          id: 301,
          title: "Harry Potter and the Philosopher's Stone",
          pages: 223,
          year: 1997,
          inStock: true,
        },
        {
          id: 302,
          title: "Harry Potter and the Chamber of Secrets",
          pages: 251,
          year: 1998,
          inStock: true,
        },
        {
          id: 303,
          title: "Harry Potter and the Prisoner of Azkaban",
          pages: 317,
          year: 1999,
          inStock: true,
        },
      ],
    },
  ],

  // User state with preferences
  user: {
    id: 123,
    name: "Reader Smith",
    favoriteGenres: ["Fantasy", "Classic"],
    borrowedBooks: [101, 301],
    readingList: [202, 302],
  },

  filters: {
    searchTerm: "",
    selectedGenres: [] as string[],
    yearRange: { min: 1800, max: new Date().getFullYear() },
    onlyShowInStock: false,
  },

  // Cached computed depending on their auto-tracked dependencies
  computed: {
    // Gets all books across all authors
    allBooks() {
      return this.authors.flatMap((author) => author.books);
    },

    // Books that match the current filters
    filteredBooks() {
      const { searchTerm, selectedGenres, onlyShowInStock, yearRange } = this.filters;

      return this.allBooks.filter((book) => {
        // Search term filter
        if (searchTerm && !book.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }

        // Only show in stock
        if (onlyShowInStock && !book.inStock) {
          return false;
        }

        // Year range filter
        if (book.year < yearRange.min || book.year > yearRange.max) {
          return false;
        }

        // Genre filter - need to find the author to check genres
        if (selectedGenres.length > 0) {
          const author = this.authors.find((a) => a.books.some((b) => b.id === book.id));

          if (!author || !author.genres.some((g) => selectedGenres.includes(g))) {
            return false;
          }
        }

        return true;
      });
    },

    // Available genres from all authors (no duplicates)
    availableGenres() {
      const genres = new Set();
      this.authors.forEach((author) => {
        author.genres.forEach((genre) => genres.add(genre));
      });
      return Array.from(genres) as string[];
    },

    // Compute borrowing statistics
    borrowingStats() {
      const borrowedCount = this.user.borrowedBooks.length;
      const readingListCount = this.user.readingList.length;

      return {
        borrowedCount,
        readingListCount,
        totalCount: borrowedCount + readingListCount,
      };
    },

    // Recommended books based on user preferences
    recommendedBooks() {
      // Books from favorite genres that aren't borrowed or in reading list
      const userBookIds = [...this.user.borrowedBooks, ...this.user.readingList];

      return this.allBooks
        .filter((book) => {
          // Skip books the user already has
          if (userBookIds.includes(book.id)) {
            return false;
          }

          // Find the book's author
          const author = this.authors.find((a) => a.books.some((b) => b.id === book.id));

          // Check if any of the author's genres match user's favorites
          return author && author.genres.some((g) => this.user.favoriteGenres.includes(g));
        })
        .slice(0, 3); // Just get top 3 recommendations
    },

    // Books in the active library location
    booksInActiveLocation() {
      // Simulate this with a simple filter based on book IDs
      const locationMap = {
        "Main Branch": [101, 102, 301],
        "North Wing": [201, 202],
        "South Wing": [103, 302, 303],
      };

      const activeLocationBooks =
        locationMap[this.library.activeLocation as keyof typeof locationMap] || [];
      return this.allBooks.filter((book) => activeLocationBooks.includes(book.id));
    },
  },

  // Actions directly available via `store.action()`
  actions: {
    // Add a book to a specific author
    addBook(authorId: number, title: string, pages: number, year: number) {
      const author = this.authors.find((a) => a.id === authorId);
      if (author) {
        const newId = Math.max(...this.allBooks.map((b) => b.id)) + 1;
        author.books.push({
          id: newId,
          title,
          pages,
          year,
          inStock: true,
        });
      }
    },

    // Borrow a book
    borrowBook(bookId: number) {
      // Check if book is in stock
      const book = this.allBooks.find((b) => b.id === bookId);
      if (book && book.inStock) {
        // Update book status
        book.inStock = false;

        // Add to user's borrowed books
        if (!this.user.borrowedBooks.includes(bookId)) {
          this.user.borrowedBooks.push(bookId);
        }

        // Remove from reading list if present
        const readingListIndex = this.user.readingList.indexOf(bookId);
        if (readingListIndex !== -1) {
          this.user.readingList.splice(readingListIndex, 1);
        }
      }
    },

    // Return a borrowed book
    returnBook(bookId: number) {
      // Update book status
      const book = this.allBooks.find((b) => b.id === bookId);
      if (book) {
        book.inStock = true;
      }

      // Remove from user's borrowed books
      const index = this.user.borrowedBooks.indexOf(bookId);
      if (index !== -1) {
        this.user.borrowedBooks.splice(index, 1);
      }
    },

    // Add/remove from reading list
    toggleReadingList(bookId: number) {
      const index = this.user.readingList.indexOf(bookId);
      if (index === -1) {
        // Add to reading list
        this.user.readingList.push(bookId);
      } else {
        // Remove from reading list
        this.user.readingList.splice(index, 1);
      }
    },

    // Update search filters
    setSearchTerm(term: string) {
      this.filters.searchTerm = term;
    },

    // Toggle a genre filter
    toggleGenreFilter(genre: string) {
      const index = this.filters.selectedGenres.indexOf(genre);
      if (index === -1) {
        this.filters.selectedGenres.push(genre);
      } else {
        this.filters.selectedGenres.splice(index, 1);
      }
    },

    // Set the year range filter
    setYearRange(min: number, max: number) {
      this.filters.yearRange = { min, max };
    },

    // Set the active library location
    setActiveLocation(location: string) {
      if (this.library.locations.includes(location)) {
        this.library.activeLocation = location;
      }
    },

    // Update a user's favorite genres
    updateFavoriteGenres(genres: string[]) {
      this.user.favoriteGenres = [...genres];
    },
  },
});

export default bookStore;

export const useBookStore = hookify("book", bookStore);
