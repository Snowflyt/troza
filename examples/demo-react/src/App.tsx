import { useState } from "react";
import AuthorSection from "./components/AuthorSection";
import BookFilters from "./components/BookFilters";
import BookList from "./components/BookList";
import RecommendationPanel from "./components/RecommendationPanel";
import UserDashboard from "./components/UserDashboard";

function App() {
  const [selectedTab, setSelectedTab] = useState<"books" | "authors" | "user">("books");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 flex flex-col items-center">
      <div className="container max-w-6xl mx-auto px-4 flex flex-col items-center">
        <header className="text-center mb-8 w-full">
          <h1 className="text-4xl font-bold text-indigo-700 mb-6">Book Collection Manager</h1>
          <p className="text-gray-600 mb-6">
            Built with React and{" "}
            <a
              className="text-indigo-600 underline hover:text-indigo-800"
              href="https://github.com/Snowflyt/troza">
              Troza
            </a>{" "}
            state management
          </p>

          {/* Navigation Tabs */}
          <div className="flex justify-center mt-6 border-b border-gray-200">
            <button
              onClick={() => setSelectedTab("books")}
              className={`px-4 py-2 font-medium ${
                selectedTab === "books" ?
                  "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
              }`}>
              Browse Books
            </button>
            <button
              onClick={() => setSelectedTab("authors")}
              className={`px-4 py-2 font-medium ${
                selectedTab === "authors" ?
                  "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
              }`}>
              Authors
            </button>
            <button
              onClick={() => setSelectedTab("user")}
              className={`px-4 py-2 font-medium ${
                selectedTab === "user" ?
                  "text-indigo-600 border-b-2 border-indigo-600"
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

        <footer className="mt-16 text-center text-gray-500 text-sm w-full">
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
