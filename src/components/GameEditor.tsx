import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { ShareModal } from "./ShareModal";
import { getSyncManager } from "../lib/syncManager";
import type { BingoItem } from "../types/types.ts";

export function GameEditor() {
  const navigate = useNavigate();
  const { code, token } = useParams<{ code: string; token: string }>();
  const { currentGame, loadGameAsAdmin, updateGameItems } = useGameStore();
  const [newItemText, setNewItemText] = useState("");
  const [items, setItems] = useState<BingoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const loadGame = async () => {
      if (!code || !token) {
        setError("Invalid game URL");
        setIsLoading(false);
        return;
      }

      try {
        await loadGameAsAdmin(code, token);
        setIsLoading(false);
      } catch {
        setError("Not authorized to edit this game");
        setIsLoading(false);
      }
    };

    loadGame();
  }, [code, token, loadGameAsAdmin]);

  // Initialize items from game when first loaded
  useEffect(() => {
    if (currentGame && items.length === 0) {
      // Check for template items
      const templateKey = `template_${currentGame.gameCode}`;
      const templateItems = localStorage.getItem(templateKey);

      if (templateItems && currentGame.items.length === 0) {
        // Use template items if game has no items yet
        const parsedItems = JSON.parse(templateItems);
        const bingoItems: BingoItem[] = parsedItems
          .slice(0, 25)
          .map((text: string, index: number) => ({
            id: crypto.randomUUID(),
            text,
            position: index,
          }));
        setItems(bingoItems);
        localStorage.removeItem(templateKey);
      } else {
        // Initialize with current game items
        setItems([...currentGame.items]);
      }
    }
  }, [currentGame]); // Only run when game first loads

  // Disconnect from SSE while editing - admin doesn't need real-time updates
  useEffect(() => {
    const syncManager = getSyncManager();
    syncManager.disconnect();
    
    return () => {
      // Already disconnected, nothing to cleanup
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || isSaving) return;

    const newItem: BingoItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      position: items.length,
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    setNewItemText("");

    // Auto-save the items immediately
    setIsSaving(true);
    await updateGameItems(updatedItems);
    setIsSaving(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (isSaving) return;

    const updatedItems = items
      .filter((item) => item.id !== itemId)
      .map((item, index) => ({ ...item, position: index }));
    setItems(updatedItems);

    // Auto-save the items immediately
    setIsSaving(true);
    await updateGameItems(updatedItems);
    setIsSaving(false);
  };

  const handleShareGame = () => {
    setShowShareModal(true);
  };

  const handleStartGame = async () => {
    if (!currentGame || isStarting) return;

    setIsStarting(true);
    try {
      const response = await fetch(`/api/game/${code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken: token }),
      });

      if (response.ok) {
        // Navigate to the game page
        navigate(`/game/${code}`);
      } else {
        console.error("Failed to start game");
      }
    } catch (error) {
      console.error("Error starting game:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleAddSuggestion = async (suggestionText: string) => {
    if (isSaving) return;

    const newItem: BingoItem = {
      id: crypto.randomUUID(),
      text: suggestionText,
      position: items.length,
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);

    // Mark suggestion as added (locally for UI feedback)
    if (currentGame?.suggestions) {
      // This is just for local UI state, the server tracks the actual state
    }

    // Auto-save the items
    setIsSaving(true);
    await updateGameItems(updatedItems);
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="text-xl text-red-600 mb-4">{error}</div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Go Home
        </button>
      </div>
    );
  }

  const gridSize = currentGame?.settings?.gridSize || 5;
  const maxItems = gridSize * gridSize;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold">{currentGame?.title}</h1>
              <p className="text-gray-600">
                Game Code: <span className="font-mono font-bold">{code}</span>
              </p>
              {!currentGame?.isStarted && (
                <p className="text-sm text-orange-600 mt-1">
                  ⚠️ Game not started yet - players are waiting
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/")}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Home
              </button>
              <button
                onClick={handleShareGame}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Share Game
              </button>
              {!currentGame?.isStarted ? (
                <button
                  onClick={handleStartGame}
                  disabled={items.length === 0 || isStarting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
                >
                  {isStarting ? "Starting..." : "🚀 Start Game"}
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/game/${code}`)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Play Game
                </button>
              )}
            </div>
          </div>

          {/* Suggestions panel - only show if game not started and has suggestions */}
          {!currentGame?.isStarted &&
            currentGame?.suggestions &&
            currentGame.suggestions.length > 0 && (
              <div className="border-t pt-4 mb-4">
                <h2 className="text-lg font-semibold mb-3">
                  📝 Player Suggestions
                </h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                  {currentGame.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="flex items-center justify-between p-2 bg-white rounded border"
                    >
                      <div className="flex-1">
                        <span className="font-medium">{suggestion.text}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          - {suggestion.suggestedBy}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAddSuggestion(suggestion.text)}
                        disabled={
                          isSaving ||
                          items.some((item) => item.text === suggestion.text)
                        }
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {items.some((item) => item.text === suggestion.text)
                          ? "✓ Added"
                          : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Bingo Items</h2>
              {isSaving && (
                <span className="text-sm text-gray-500 animate-pulse">
                  Saving...
                </span>
              )}
            </div>
            <form onSubmit={handleAddItem} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter bingo item text..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                disabled={items.length >= maxItems}
              />
              <button
                type="submit"
                disabled={
                  !newItemText.trim() || items.length >= maxItems || isSaving
                }
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Add Item"}
              </button>
            </form>

            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No items added yet. Start adding items for your bingo game!
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 border rounded-lg"
                  >
                    <span className="w-8 text-center text-gray-500">
                      {index + 1}.
                    </span>
                    <span className="flex-1">{item.text}</span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isSaving}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
          <p className="text-sm">
            <strong>Tip:</strong> Add items for your bingo game. Players will
            see these items randomly arranged on their bingo boards.
          </p>
        </div>
      </div>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        gameCode={code || ""}
        gameTitle={currentGame?.title || ""}
        adminToken={token}
      />
    </div>
  );
}
