import { create } from 'zustand';
import { produce } from 'immer';
import type { Game, PlayerState, BingoItem } from '../../../shared/src/types';
import { generateGameCode, generateAdminToken } from '../lib/calculations';
import { 
  saveGameLocal, 
  loadLocalGames, 
  loadGameByCode,
  deleteGameLocal,
  savePlayerState,
  loadPlayerState 
} from '../lib/storage';

interface GameStore {
  // Immutable state
  currentGame: Game | null;
  playerState: PlayerState | null;
  localGames: readonly { id: string; gameCode: string; adminToken?: string; title: string }[];
  isLoading: boolean;
  
  // Actions (thin layer over calculations)
  createGame: (title: string) => Promise<Game>;
  loadGame: (gameCode: string) => Promise<void>;
  loadGameAsAdmin: (gameCode: string, adminToken: string) => Promise<void>;
  updateGameItems: (items: BingoItem[]) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  
  // Player actions
  joinGame: (gameCode: string, displayName: string) => Promise<void>;
  markItem: (itemId: string) => void;
  clearMarkedItems: () => void;
  
  // Initialize store
  initialize: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentGame: null,
  playerState: null,
  localGames: [],
  isLoading: false,
  
  createGame: async (title) => {
    const game: Game = {
      id: crypto.randomUUID(),
      adminToken: generateAdminToken(),
      gameCode: generateGameCode(),
      title,
      items: [],
      settings: { gridSize: 5, requireFullCard: false, freeSpace: true },
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
    };
    
    await saveGameLocal(game);
    
    set(produce(draft => {
      draft.currentGame = game;
      draft.localGames.push({
        id: game.id,
        gameCode: game.gameCode,
        adminToken: game.adminToken,
        title: game.title,
      });
    }));
    
    return game;
  },
  
  loadGame: async (gameCode) => {
    set({ isLoading: true });
    
    const game = await loadGameByCode(gameCode);
    const playerState = await loadPlayerState(gameCode);
    
    set({
      currentGame: game || null,
      playerState: playerState || null,
      isLoading: false,
    });
  },
  
  loadGameAsAdmin: async (gameCode, adminToken) => {
    set({ isLoading: true });
    
    const game = await loadGameByCode(gameCode);
    
    if (game && game.adminToken === adminToken) {
      set({
        currentGame: game,
        isLoading: false,
      });
    } else {
      set({
        currentGame: null,
        isLoading: false,
      });
      throw new Error('Invalid admin token');
    }
  },
  
  updateGameItems: async (items) => {
    const { currentGame } = get();
    if (!currentGame) return;
    
    const updatedGame: Game = {
      ...currentGame,
      items,
      lastModifiedAt: Date.now(),
    };
    
    await saveGameLocal(updatedGame);
    
    set(produce(draft => {
      draft.currentGame = updatedGame;
      const gameIndex = draft.localGames.findIndex((g: any) => g.id === updatedGame.id);
      if (gameIndex >= 0) {
        draft.localGames[gameIndex] = {
          id: updatedGame.id,
          gameCode: updatedGame.gameCode,
          adminToken: updatedGame.adminToken,
          title: updatedGame.title,
        };
      }
    }));
  },
  
  deleteGame: async (gameId) => {
    await deleteGameLocal(gameId);
    
    set(produce(draft => {
      draft.localGames = draft.localGames.filter((g: any) => g.id !== gameId);
      if (draft.currentGame?.id === gameId) {
        draft.currentGame = null;
      }
    }));
  },
  
  joinGame: async (gameCode, displayName) => {
    const game = await loadGameByCode(gameCode);
    if (!game) throw new Error('Game not found');
    
    const playerState: PlayerState = {
      gameCode,
      displayName,
      markedItems: [],
      lastSyncAt: Date.now(),
    };
    
    await savePlayerState(playerState);
    
    set({
      currentGame: game,
      playerState,
    });
  },
  
  markItem: (itemId) => {
    set(produce(draft => {
      if (!draft.playerState) return;
      
      const marked = draft.playerState.markedItems;
      if (marked.includes(itemId)) {
        draft.playerState.markedItems = marked.filter((id: string) => id !== itemId);
      } else {
        draft.playerState.markedItems = [...marked, itemId];
      }
      
      draft.playerState.lastSyncAt = Date.now();
    }));
    
    // Save updated player state
    const { playerState } = get();
    if (playerState) {
      savePlayerState(playerState);
    }
  },
  
  clearMarkedItems: () => {
    set(produce(draft => {
      if (!draft.playerState) return;
      draft.playerState.markedItems = [];
      draft.playerState.lastSyncAt = Date.now();
    }));
    
    // Save updated player state
    const { playerState } = get();
    if (playerState) {
      savePlayerState(playerState);
    }
  },
  
  initialize: async () => {
    set({ isLoading: true });
    
    const games = await loadLocalGames();
    const localGames = games.map(game => ({
      id: game.id,
      gameCode: game.gameCode,
      adminToken: game.adminToken,
      title: game.title,
    }));
    
    set({
      localGames,
      isLoading: false,
    });
  },
}));