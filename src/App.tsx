import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "./components/HomePage";
import { GamePlayer } from "./components/GamePlayer";
import { GameEditor } from "./components/GameEditor";
import { ErrorBoundary, GameErrorBoundary } from "./components/ErrorBoundary";
import { processPendingEvents } from "./lib/storage";

function AppContent() {
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <ErrorBoundary context="HomePage">
              <HomePage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/game/:code"
          element={
            <GameErrorBoundary>
              <GamePlayer />
            </GameErrorBoundary>
          }
        />
        <Route
          path="/game/:code/admin/:token"
          element={
            <GameErrorBoundary>
              <GameEditor />
            </GameErrorBoundary>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  useEffect(() => {
    // Process pending events on app start
    processPendingEvents();

    // Retry every 30 seconds if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        processPendingEvents();
      }
    }, 30000);

    // Sync when coming back online
    const handleOnline = () => processPendingEvents();
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <ErrorBoundary context="App">
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
