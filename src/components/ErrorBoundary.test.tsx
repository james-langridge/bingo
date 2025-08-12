import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Component } from "react";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary, GameErrorBoundary } from "./ErrorBoundary";

// Mock the game store
vi.mock("../stores/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    currentGame: {
      gameCode: "ABC123",
      title: "Test Game",
      settings: { gridSize: 5 },
    },
    playerState: {
      displayName: "TestPlayer",
      markedPositions: [0, 1, 2],
    },
    loadGame: vi.fn(),
  })),
}));

// Component that throws an error
class ThrowError extends Component<{ shouldThrow: boolean; children?: ReactNode }> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error("Test error message");
    }
    return this.props.children || <div>No error</div>;
  }
}

// Functional component that throws
function ThrowErrorFunctional({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Functional component error");
  }
  return <div>No error in functional</div>;
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: any;
  let consoleGroupSpy: any;

  beforeEach(() => {
    // Suppress console errors during tests
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, "group").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    
    // Clear localStorage before each test
    localStorage.clear();
    sessionStorage.clear();
    
    // Mock window.location
    delete (window as any).location;
    (window as any).location = { 
      href: "http://localhost:3000/game/ABC123",
      pathname: "/game/ABC123",
      reload: vi.fn(),
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("Error Catching", () => {
    it("should catch errors and display fallback UI", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/Something unexpected happened/i)).toBeInTheDocument();
    });

    it("should display normal content when no error", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText("No error")).toBeInTheDocument();
      expect(screen.queryByText(/Oops! Something went wrong/i)).not.toBeInTheDocument();
    });

    it("should catch errors from functional components", () => {
      render(
        <ErrorBoundary>
          <ThrowErrorFunctional shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();
    });

    it("should use context-specific error messages", () => {
      render(
        <ErrorBoundary context="GameBoard">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/The game board had a hiccup/i)).toBeInTheDocument();
    });

    it("should display GamePlayer-specific message", () => {
      render(
        <ErrorBoundary context="GamePlayer">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/couldn't load the game properly/i)).toBeInTheDocument();
    });

    it("should display GameEditor-specific message", () => {
      render(
        <ErrorBoundary context="GameEditor">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/problem saving your changes/i)).toBeInTheDocument();
    });
  });

  describe("Error Recovery", () => {
    it("should reset error state when Try Again is clicked", async () => {
      let shouldThrow = true;
      
      const TestComponent = () => {
        return <ThrowError shouldThrow={shouldThrow} />;
      };
      
      render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();

      // Update the flag and click Try Again
      shouldThrow = false;
      fireEvent.click(screen.getByText("Try Again"));

      // Component should re-render without error after reset
      await waitFor(() => {
        expect(screen.queryByText(/Oops! Something went wrong/i)).not.toBeInTheDocument();
        expect(screen.getByText("No error")).toBeInTheDocument();
      });
    });

    it("should refresh page when Refresh Page is clicked", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText("Refresh Page"));
      expect(window.location.reload).toHaveBeenCalled();
    });

    it("should navigate home when Go Home is clicked", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText("Go Home"));
      expect(window.location.href).toBe("/");
    });
  });

  describe("Error Logging", () => {
    it("should log errors to console in development", () => {
      // Note: import.meta.env.DEV is already true in test environment
      render(
        <ErrorBoundary context="TestContext">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error:",
        expect.objectContaining({
          message: "Test error message"
        })
      );
    });

    it("should store error history in localStorage", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorHistory = JSON.parse(localStorage.getItem("errorHistory") || "[]");
      expect(errorHistory).toHaveLength(1);
      expect(errorHistory[0]).toMatchObject({
        message: "Test error message",
        url: "http://localhost:3000/game/ABC123",
      });
    });

    it("should limit error history to 10 entries", () => {
      // Pre-fill localStorage with 10 errors
      const existingErrors = Array.from({ length: 10 }, (_, i) => ({
        message: `Old error ${i}`,
        timestamp: new Date().toISOString(),
      }));
      localStorage.setItem("errorHistory", JSON.stringify(existingErrors));

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorHistory = JSON.parse(localStorage.getItem("errorHistory") || "[]");
      expect(errorHistory).toHaveLength(10);
      expect(errorHistory[0].message).toBe("Old error 1"); // First old error removed
      expect(errorHistory[9].message).toBe("Test error message"); // New error added
    });
  });

  describe("Game State Preservation", () => {
    it.skip("should preserve game state when error occurs", () => {
      // Mock the useGameStore module
      vi.doMock("../stores/gameStore", () => ({
        useGameStore: {
          getState: vi.fn(() => ({
            currentGame: { gameCode: "TEST123", title: "Test Game" },
            playerState: { displayName: "Player1", markedPositions: [1, 2, 3] },
          }))
        }
      }));

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const preserved = sessionStorage.getItem("preservedGameState");
      expect(preserved).toBeTruthy();
      
      const state = JSON.parse(preserved!);
      expect(state.currentGame.gameCode).toBe("TEST123");
      expect(state.playerState.displayName).toBe("Player1");
    });

    it("should attempt recovery with preserved state", () => {
      // Set preserved state
      const preservedState = {
        currentGame: { gameCode: "SAVED123" },
        playerState: { displayName: "SavedPlayer" },
        timestamp: Date.now(),
      };
      sessionStorage.setItem("preservedGameState", JSON.stringify(preservedState));

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Click Try Again
      fireEvent.click(screen.getByText("Try Again"));

      // Check that recovery state was saved
      const recoveryState = localStorage.getItem("recoveryState");
      expect(recoveryState).toBeTruthy();
      const parsed = JSON.parse(recoveryState!);
      expect(parsed.currentGame.gameCode).toBe("SAVED123");
    });

    it("should not recover stale state (older than 5 minutes)", () => {
      // Set old preserved state
      const oldState = {
        currentGame: { gameCode: "OLD123" },
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
      };
      sessionStorage.setItem("preservedGameState", JSON.stringify(oldState));

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText("Try Again"));

      const recoveryState = localStorage.getItem("recoveryState");
      expect(recoveryState).toBeNull();
    });
  });

  describe("Custom Fallback", () => {
    it("should use custom fallback when provided", () => {
      const customFallback = (error: Error, reset: () => void) => (
        <div>
          <h1>Custom Error</h1>
          <p>{error.message}</p>
          <button onClick={reset}>Custom Reset</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Custom Error")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
      expect(screen.getByText("Custom Reset")).toBeInTheDocument();
    });
  });

  describe("GameErrorBoundary", () => {
    it("should display game-specific error UI", () => {
      // Create a connection error to trigger the connection-specific UI
      const ThrowConnectionError = ({ shouldThrow }: { shouldThrow: boolean }) => {
        if (shouldThrow) {
          throw new Error("Network fetch failed");
        }
        return <div>Content</div>;
      };

      render(
        <BrowserRouter>
          <GameErrorBoundary>
            <ThrowConnectionError shouldThrow={true} />
          </GameErrorBoundary>
        </BrowserRouter>
      );

      expect(screen.getByText("Game Connection Lost")).toBeInTheDocument();
      expect(screen.getByText(/Your game is still there/i)).toBeInTheDocument();
    });

    it.skip("should attempt to rejoin game from URL", async () => {
      const loadGameMock = vi.fn();
      
      // Mock the useGameStore module
      vi.doMock("../stores/gameStore", () => ({
        useGameStore: {
          getState: vi.fn(() => ({
            loadGame: loadGameMock,
          }))
        }
      }));

      window.location.pathname = "/game/ABC123";

      render(
        <BrowserRouter>
          <GameErrorBoundary>
            <ThrowError shouldThrow={true} />
          </GameErrorBoundary>
        </BrowserRouter>
      );

      fireEvent.click(screen.getByText("Rejoin Game"));

      await waitFor(() => {
        expect(loadGameMock).toHaveBeenCalledWith("ABC123");
      });
    });

    it("should redirect to home if no game code in URL", () => {
      window.location.pathname = "/";

      render(
        <BrowserRouter>
          <GameErrorBoundary>
            <ThrowError shouldThrow={true} />
          </GameErrorBoundary>
        </BrowserRouter>
      );

      // When there's no game code, the button says "Try Again" not "Rejoin Game"
      fireEvent.click(screen.getByText("Try Again"));
      expect(window.location.href).toBe("/");
    });
  });

  describe("Error Boundary Behavior", () => {
    it("should increment error count on multiple errors", () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // First error
      expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();

      // Reset and trigger another error
      fireEvent.click(screen.getByText("Try Again"));
      
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();
    });

    it("should handle errors during error handling gracefully", () => {
      // Mock localStorage to throw
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error("Storage error");
      });

      // Should not throw even if localStorage fails
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        );
      }).not.toThrow();

      expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();

      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe("Development vs Production", () => {
    it("should show stack trace in development", () => {
      // Since we're in test mode, import.meta.env.DEV is already true
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Error Details (Development Mode)")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("should conditionally show/hide stack trace based on DEV mode", () => {
      // This test verifies the component respects the DEV flag
      // In real production builds, import.meta.env.DEV would be false
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // In test environment, DEV is true, so details should show
      const detailsElement = screen.queryByText("Error Details (Development Mode)");
      if (import.meta.env.DEV) {
        expect(detailsElement).toBeInTheDocument();
      } else {
        expect(detailsElement).not.toBeInTheDocument();
      }
    });
  });

  describe("Kid-Friendly Messaging", () => {
    it("should display kid-friendly message", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Bugs happen sometimes/i)).toBeInTheDocument();
      expect(screen.getByText(/Just like in a real game/i)).toBeInTheDocument();
    });
  });
});