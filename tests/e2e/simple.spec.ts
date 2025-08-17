import { test, expect, type Page } from "@playwright/test";

test.describe("Basic Game Flow", () => {
  test("should create and play a game", async ({ page }) => {
    // Go to home page
    await page.goto("/");

    // Create a game
    await page.getByPlaceholder(/Game Title/i).fill("Test Game");
    await page.getByRole("button", { name: /create game/i }).click();

    // Wait for admin page (game creation goes directly to admin view)
    await page.waitForURL(/\/game\/.+\/admin\/.+/, { timeout: 10000 });

    // Add a few items
    const input = page.getByPlaceholder("Enter bingo item text...");
    for (let i = 0; i < 3; i++) {
      await input.fill(`Item ${i + 1}`);
      await input.press("Enter");
      await page.waitForTimeout(200);
    }

    // Click Play Game to save and start playing
    await page.getByRole("button", { name: /play game/i }).click();

    // Should navigate to game page
    await page.waitForURL(/\/game\/.+/, { timeout: 10000 });

    // Check if we're on a game page with a code
    const url = page.url();
    expect(url).toMatch(/\/game\/[A-Z0-9]{6}/);

    // Enter player name when prompted
    const nameInput = page.getByPlaceholder("Enter your name");
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    await nameInput.fill("Test Player");
    await page.getByRole("button", { name: /join game/i }).click();

    // Wait for game board (might need to wait for name entry to complete first)
    await page.waitForSelector('[data-testid="game-board"]', {
      timeout: 15000,
    });

    // Verify tiles are visible (at least 2)
    const tiles = page.locator('[data-testid="tile"]');
    const tileCount = await tiles.count();
    expect(tileCount).toBeGreaterThanOrEqual(2);

    // Click a tile
    const firstTile = tiles.first();
    await firstTile.click();

    // Verify the tile shows a marker (the green count indicator)
    await page.waitForTimeout(500);
    const indicator = firstTile.locator('[data-testid="player-indicator"]');
    await expect(indicator).toBeVisible();
  });
});
