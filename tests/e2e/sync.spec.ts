import { test, expect, type Page, type BrowserContext } from "@playwright/test";

test.describe("Multi-device Game Synchronization", () => {
  let gameCode: string;

  async function createGame(page: Page): Promise<string> {
    await page.goto("/");

    // Fill in the game title on the home page
    await page.getByPlaceholder(/Game Title/i).fill("Test Sync Game");

    // Click the Create Game button
    await page.getByRole("button", { name: /create game/i }).click();

    // Wait for navigation to the admin page
    await page.waitForURL(/\/game\/.+\/admin\/.+/, { timeout: 10000 });

    // Add some tiles
    for (let i = 0; i < 3; i++) {
      const input = page.getByPlaceholder("Enter bingo item text...");
      await input.fill(`Item ${i + 1}`);
      await input.press("Enter");
      await page.waitForTimeout(500); // Give time for the item to be added
    }

    // Click Play Game to save and start playing
    await page.getByRole("button", { name: /play game/i }).click();

    // Wait for the game code to appear in the URL
    await page.waitForURL(/\/game\/.+/, { timeout: 10000 });

    // Extract the game code from the URL
    const url = page.url();
    const match = url.match(/\/game\/([^/]+)/);
    if (!match) throw new Error("Could not extract game code from URL");

    return match[1];
  }

  async function joinGame(page: Page, code: string): Promise<void> {
    await page.goto(`/game/${code}`);

    // Wait for the game to load - either join form or game board
    await page.waitForSelector(
      '[data-testid="game-board"], input[placeholder="Enter your name"]',
      { timeout: 10000 },
    );
  }

  async function enterPlayerName(page: Page, name: string): Promise<void> {
    // Wait for and fill in the name input
    const nameInput = page.getByPlaceholder("Enter your name");
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    await nameInput.fill(name);
    await page.getByRole("button", { name: /join game/i }).click();

    // Wait for the game board to appear
    await page.waitForSelector('[data-testid="game-board"]', {
      timeout: 10000,
    });
  }

  async function toggleTile(page: Page, tileText: string): Promise<void> {
    // Find and click the tile with the specified text
    const tile = page
      .locator('[data-testid="tile"]')
      .filter({ hasText: tileText });
    await tile.waitFor({ state: "visible", timeout: 5000 });
    await tile.click();

    // Wait a bit for the click to register
    await page.waitForTimeout(500);
  }

  async function isTileMarked(page: Page, tileText: string): Promise<boolean> {
    const tile = page
      .locator(`[data-testid="tile"]`)
      .filter({ hasText: tileText });

    // Check if the tile has the marked state (could be a class, attribute, or child element)
    // This depends on your implementation - adjust as needed
    const classes = await tile.getAttribute("class");
    return (
      classes?.includes("marked") || classes?.includes("bg-green") || false
    );
  }

  async function getPlayerIndicators(
    page: Page,
    tileText: string,
  ): Promise<string[]> {
    const tile = page
      .locator(`[data-testid="tile"]`)
      .filter({ hasText: tileText });

    // Look for player indicators within the tile
    const indicators = tile.locator('[data-testid="player-indicator"]');
    const count = await indicators.count();

    const players: string[] = [];
    for (let i = 0; i < count; i++) {
      // Get the screen reader text which contains the player name
      const srOnly = await indicators.nth(i).locator(".sr-only").textContent();
      if (srOnly) {
        players.push(srOnly.trim());
      }
    }

    return players;
  }

  test("should sync tile selections between two players", async ({
    browser,
  }) => {
    // Create two browser contexts (simulating two different devices)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const player1 = await context1.newPage();
    const player2 = await context2.newPage();

    try {
      // Player 1 creates a game
      console.log("Player 1 creating game...");
      gameCode = await createGame(player1);
      console.log(`Game created with code: ${gameCode}`);

      // Enter player 1's name
      await enterPlayerName(player1, "Player 1");

      // Player 2 joins the same game
      console.log("Player 2 joining game...");
      await joinGame(player2, gameCode);
      await enterPlayerName(player2, "Player 2");

      // Wait for both players to be fully connected
      await player1.waitForTimeout(1000);
      await player2.waitForTimeout(1000);

      // Player 1 marks a tile
      console.log("Player 1 marking Item 1...");
      await toggleTile(player1, "Item 1");

      // Wait for sync to happen (polling happens every 2 seconds)
      await player2.waitForTimeout(2500);

      // Check that Player 2 sees the tile as marked by Player 1
      console.log("Checking if Player 2 sees the update...");
      const indicators = await getPlayerIndicators(player2, "Item 1");
      expect(indicators).toContain("Player 1");

      // Player 2 marks a different tile
      console.log("Player 2 marking Item 2...");
      await toggleTile(player2, "Item 2");

      // Wait for sync
      await player1.waitForTimeout(2500);

      // Check that Player 1 sees the tile marked by Player 2
      console.log("Checking if Player 1 sees Player 2's update...");
      const indicators2 = await getPlayerIndicators(player1, "Item 2");
      expect(indicators2).toContain("Player 2");

      // Both players mark the same tile
      console.log("Both players marking Item 3...");
      await toggleTile(player1, "Item 3");
      await player2.waitForTimeout(2500);
      await toggleTile(player2, "Item 3");

      // Wait for sync
      await player1.waitForTimeout(2500);
      await player2.waitForTimeout(1000);

      // Check that both players see both marks on Item 3
      console.log("Checking if both players see both marks on Item 3...");
      const indicators3Player1 = await getPlayerIndicators(player1, "Item 3");
      const indicators3Player2 = await getPlayerIndicators(player2, "Item 3");

      expect(indicators3Player1).toContain("Player 1");
      expect(indicators3Player1).toContain("Player 2");
      expect(indicators3Player2).toContain("Player 1");
      expect(indicators3Player2).toContain("Player 2");
    } finally {
      // Clean up
      await context1.close();
      await context2.close();
    }
  });

  test("should sync when player unmarking tiles", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const player1 = await context1.newPage();
    const player2 = await context2.newPage();

    try {
      // Player 1 creates a game
      gameCode = await createGame(player1);
      await enterPlayerName(player1, "Alice");

      // Player 2 joins
      await joinGame(player2, gameCode);
      await enterPlayerName(player2, "Bob");

      // Wait for connection
      await player1.waitForTimeout(2000);
      await player2.waitForTimeout(2000);

      // Player 1 marks a tile
      await toggleTile(player1, "Item 1");
      await player2.waitForTimeout(3000);

      // Verify Player 2 sees it
      let indicators = await getPlayerIndicators(player2, "Item 1");
      expect(indicators).toContain("Alice");

      // Player 1 unmarks the tile
      await toggleTile(player1, "Item 1");
      await player2.waitForTimeout(3000);

      // Verify Player 2 sees the tile is unmarked
      indicators = await getPlayerIndicators(player2, "Item 1");
      expect(indicators).not.toContain("Alice");
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("should handle rapid concurrent updates", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const player1 = await context1.newPage();
    const player2 = await context2.newPage();
    const player3 = await context3.newPage();

    try {
      // Player 1 creates a game with more tiles
      await player1.goto("/");
      await player1.getByRole("button", { name: /create game/i }).click();
      await player1.getByPlaceholder("Game Title").fill("Stress Test Game");

      // Add 9 tiles for a 3x3 grid
      for (let i = 0; i < 9; i++) {
        await player1.getByPlaceholder("New item...").fill(`Tile ${i + 1}`);
        await player1.getByPlaceholder("New item...").press("Enter");
      }

      await player1.getByRole("button", { name: /save game/i }).click();
      await player1.waitForURL(/\/game\/.+/);

      const url = player1.url();
      gameCode = url.match(/\/game\/([^/]+)/)![1];

      await enterPlayerName(player1, "P1");

      // Other players join
      await joinGame(player2, gameCode);
      await enterPlayerName(player2, "P2");

      await joinGame(player3, gameCode);
      await enterPlayerName(player3, "P3");

      // Wait for all to connect
      await Promise.all([
        player1.waitForTimeout(2000),
        player2.waitForTimeout(2000),
        player3.waitForTimeout(2000),
      ]);

      // All players rapidly mark different tiles
      await Promise.all([
        toggleTile(player1, "Tile 1"),
        toggleTile(player2, "Tile 2"),
        toggleTile(player3, "Tile 3"),
      ]);

      // Wait for sync
      await Promise.all([
        player1.waitForTimeout(5000),
        player2.waitForTimeout(5000),
        player3.waitForTimeout(5000),
      ]);

      // Verify all players see all marks
      for (const [page, playerName] of [
        [player1, "P1"],
        [player2, "P2"],
        [player3, "P3"],
      ] as const) {
        const tile1Indicators = await getPlayerIndicators(page, "Tile 1");
        const tile2Indicators = await getPlayerIndicators(page, "Tile 2");
        const tile3Indicators = await getPlayerIndicators(page, "Tile 3");

        expect(tile1Indicators).toContain("P1");
        expect(tile2Indicators).toContain("P2");
        expect(tile3Indicators).toContain("P3");
      }
    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });
});
