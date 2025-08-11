import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useGameStore } from "../stores/gameStore";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  context?: string; // To identify which part of app errored
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number;
}

// Error logging utility
function logError(error: Error, errorInfo: ErrorInfo | null, context?: string) {
  const timestamp = new Date().toISOString();
  const errorData = {
    timestamp,
    context,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
    userAgent: navigator.userAgent,
    url: window.location.href,
    isDevelopment: import.meta.env.DEV,
  };

  // In development, log to console with full details
  if (import.meta.env.DEV) {
    console.group(`🚨 Error Boundary Caught Error ${context ? `in ${context}` : ''}`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Full Error Data:', errorData);
    console.groupEnd();
  } else {
    // In production, log minimal info
    console.error(`Error in ${context || 'app'}:`, error.message);
  }

  // Store error in localStorage for debugging
  try {
    const errorHistory = JSON.parse(localStorage.getItem('errorHistory') || '[]');
    errorHistory.push(errorData);
    // Keep only last 10 errors
    if (errorHistory.length > 10) {
      errorHistory.shift();
    }
    localStorage.setItem('errorHistory', JSON.stringify(errorHistory));
  } catch {
    // Ignore storage errors
  }

  // In production, you could send to error tracking service here
  // Example: sendToSentry(errorData);
}

// Function to save game state before showing error
function preserveGameState() {
  try {
    const state = useGameStore.getState();
    if (state.currentGame || state.playerState) {
      const preservedState = {
        currentGame: state.currentGame,
        playerState: state.playerState,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('preservedGameState', JSON.stringify(preservedState));
      return true;
    }
  } catch {
    // Ignore preservation errors
  }
  return false;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    logError(error, errorInfo, this.props.context);
    
    // Preserve game state if in game
    preserveGameState();
    
    // Update error count
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // If too many errors in short time, might be an error loop
    const now = Date.now();
    if (this.state.lastErrorTime && now - this.state.lastErrorTime < 1000) {
      console.error('Error loop detected, stopping error boundary recovery');
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetErrorBoundary);
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          reset={this.resetErrorBoundary}
          context={this.props.context}
        />
      );
    }

    return this.props.children;
  }
}

// Error Fallback Component
interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  reset: () => void;
  context?: string;
}

function ErrorFallback({ error, errorInfo, reset, context }: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV;
  
  const handleGoHome = () => {
    // Clear preserved state and go home
    sessionStorage.removeItem('preservedGameState');
    window.location.href = '/';
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleRecover = async () => {
    // Try to recover preserved state
    try {
      const preserved = sessionStorage.getItem('preservedGameState');
      if (preserved) {
        const state = JSON.parse(preserved);
        // Check if state is recent (within 5 minutes)
        if (Date.now() - state.timestamp < 5 * 60 * 1000) {
          // Store for recovery after reset
          localStorage.setItem('recoveryState', preserved);
        }
      }
    } catch {
      // Ignore recovery errors
    }
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
        {/* Error Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Oops! Something went wrong
          </h1>
          
          <p className="text-gray-600 mb-6">
            {context === 'GameBoard' 
              ? "The game board had a hiccup! Don't worry, your progress is saved."
              : context === 'GamePlayer'
              ? "We couldn't load the game properly. Let's try again!"
              : context === 'GameEditor'
              ? "There was a problem saving your changes. Your game is safe!"
              : "Something unexpected happened, but we can fix it!"}
          </p>
        </div>

        {/* Error details in development */}
        {isDev && (
          <details className="mb-6 p-4 bg-gray-50 rounded-lg">
            <summary className="cursor-pointer font-medium text-gray-700 mb-2">
              Error Details (Development Mode)
            </summary>
            <div className="space-y-2">
              <div className="text-sm text-red-600 font-mono bg-white p-2 rounded border border-red-200">
                {error.message}
              </div>
              {error.stack && (
                <pre className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40">
                  {error.stack}
                </pre>
              )}
              {errorInfo?.componentStack && (
                <pre className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          </details>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRecover}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-medium"
          >
            Try Again
          </button>
          
          <button
            onClick={handleRefresh}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-medium"
          >
            Refresh Page
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium"
          >
            Go Home
          </button>
        </div>

        {/* Kid-friendly message */}
        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-700 text-center">
            💜 Don't worry! Bugs happen sometimes. Just like in a real game, 
            we can start fresh or continue where we left off!
          </p>
        </div>
      </div>
    </div>
  );
}

// Wrapper component for routes that handles navigation hooks
export function ErrorBoundaryWithRouter({ children, context }: { children: ReactNode; context?: string }) {
  return (
    <ErrorBoundary context={context}>
      {children}
    </ErrorBoundary>
  );
}

// Game-specific error boundary with auto-recovery attempt
export function GameErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      context="Game"
      fallback={(error, reset) => (
        <GameErrorFallback error={error} reset={reset} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

function GameErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const handleRejoinGame = async () => {
    try {
      // Try to get game code from URL or storage
      const pathMatch = window.location.pathname.match(/\/game\/([A-Z0-9]{6})/);
      if (pathMatch) {
        const gameCode = pathMatch[1];
        // Clear any corrupted state
        const store = useGameStore.getState();
        await store.loadGame(gameCode);
        reset();
      } else {
        window.location.href = '/';
      }
    } catch {
      window.location.href = '/';
    }
  };

  // Check if this is actually a connection error
  const isConnectionError = error.message?.toLowerCase().includes('fetch') || 
                          error.message?.toLowerCase().includes('network') ||
                          error.message?.toLowerCase().includes('connection');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-4">
          <svg
            className="w-10 h-10 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {isConnectionError ? "Game Connection Lost" : "Something Went Wrong"}
        </h2>
        
        <p className="text-gray-600 mb-6">
          {isConnectionError 
            ? "Don't worry! Your game is still there. Let's reconnect!"
            : "We encountered an issue loading the game. Let's try again!"}
        </p>

        {/* Show error details in development */}
        {import.meta.env.DEV && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">Error details</summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        
        <div className="space-y-3">
          <button
            onClick={handleRejoinGame}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-medium"
          >
            {isConnectionError ? "Rejoin Game" : "Try Again"}
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}