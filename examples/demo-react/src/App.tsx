import { useState } from "react";
import AuthorSection from "./components/AuthorSection";
import BookFilters from "./components/BookFilters";
import BookList from "./components/BookList";
import RecommendationPanel from "./components/RecommendationPanel";
import UserDashboard from "./components/UserDashboard";

function App() {
  const [selectedTab, setSelectedTab] = useState<"books" | "authors" | "user">("books");

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto flex max-w-6xl flex-col items-center px-4">
        <header className="mb-8 w-full text-center">
          <h1 className="mb-6 text-4xl font-bold text-indigo-700">Book Collection Manager</h1>
          <p className="mb-6 text-gray-600">
            Built with React and{" "}
            <a
              className="text-indigo-600 underline hover:text-indigo-800"
              href="https://github.com/Snowflyt/troza">
              Troza
            </a>{" "}
            state management
          </p>

          {/* Navigation Tabs */}
          <div className="mt-6 flex justify-center border-b border-gray-200">
            <button
              onClick={() => setSelectedTab("books")}
              className={`px-4 py-2 font-medium ${
                selectedTab === "books" ?
                  "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
              }`}>
              Browse Books
            </button>
            <button
              onClick={() => setSelectedTab("authors")}
              className={`px-4 py-2 font-medium ${
                selectedTab === "authors" ?
                  "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
              }`}>
              Authors
            </button>
            <button
              onClick={() => setSelectedTab("user")}
              className={`px-4 py-2 font-medium ${
                selectedTab === "user" ?
                  "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
              }`}>
              My Dashboard
            </button>
          </div>
        </header>

        <main className="w-full">
          {selectedTab === "books" && (
            <div className="space-y-6">
              <BookFilters />
              <BookList />
              <RecommendationPanel />
            </div>
          )}

          {selectedTab === "authors" && <AuthorSection />}

          {selectedTab === "user" && <UserDashboard />}
        </main>

        <footer className="mt-16 w-full text-center text-sm text-gray-500">
          <p>
            Demo application for{" "}
            <a
              className="text-indigo-600 underline hover:text-indigo-800"
              href="https://github.com/Snowflyt/troza">
              Troza
            </a>{" "}
            state management
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
