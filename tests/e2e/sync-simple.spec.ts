import { test, expect, type Page, type BrowserContext } from "@playwright/test";

test.describe("Simple Sync Test", () => {
  test("should sync between two players", async ({ browser }) => {
    // Create two browser contexts (simulating two different devices)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const player1 = await context1.newPage();
    const player2 = await context2.newPage();

    try {
      // Player 1 creates a game
      await player1.goto("/");
      await player1.getByPlaceholder(/Game Title/i).fill("Sync Test Game");
      await player1.getByRole("button", { name: /create game/i }).click();

      // Wait for admin page
      await player1.waitForURL(/\/game\/.+\/admin\/.+/, { timeout: 10000 });

      // Add one item
      const input = player1.getByPlaceholder("Enter bingo item text...");
      await input.fill("Test Item");
      await input.press("Enter");
      await player1.waitForTimeout(500);

      // Get the game code from URL
      const url = player1.url();
      const match = url.match(/\/game\/([A-Z0-9]{6})/);
      if (!match) throw new Error("Could not extract game code");
      const gameCode = match[1];
      console.log(`Game created with code: ${gameCode}`);

      // Player 1 clicks Start Game
      await player1.getByRole("button", { name: /start game/i }).click();

      // Player 1 enters name
      await player1.getByPlaceholder("Enter your name").fill("Player 1");
      await player1.getByRole("button", { name: /join game/i }).click();
      await player1.waitForSelector('[data-testid="game-board"]', {
        timeout: 10000,
      });

      // Player 2 joins the same game
      await player2.goto(`/game/${gameCode}`);
      await player2.getByPlaceholder("Enter your name").fill("Player 2");
      await player2.getByRole("button", { name: /join game/i }).click();
      await player2.waitForSelector('[data-testid="game-board"]', {
        timeout: 10000,
      });

      // Player 1 marks the tile
      const tile1 = player1.locator('[data-testid="tile"]').first();
      await tile1.click();
      console.log("Player 1 marked the tile");

      // Wait for the polling cycle (2.5 seconds should be enough)
      await player1.waitForTimeout(3000);
      await player2.waitForTimeout(3000);

      // Check that Player 2 sees Player 1's mark
      const player2Tile = player2.locator('[data-testid="tile"]').first();
      const indicators = player2Tile.locator(
        '[data-testid="player-indicator"]',
      );
      const indicatorCount = await indicators.count();

      // Should see at least one indicator (Player 1's mark)
      expect(indicatorCount).toBeGreaterThan(0);
      console.log(`Player 2 sees ${indicatorCount} indicator(s)`);
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
