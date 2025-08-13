import { describe, test, expect } from "vitest";
import {
  generateGameCode,
  generateAdminToken,
  checkWinCondition,
  shuffleItems,
  generateDummyItems,
} from "./calculations";

describe("generateGameCode", () => {
  test("generates 6-character game codes", () => {
    const code = generateGameCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(code.length).toBe(6);
  });

  test("excludes ambiguous characters", () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 100; i++) {
      const code = generateGameCode();
      expect(code).not.toMatch(/[01IOlo]/);
    }
  });

  test("generates different codes", () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateGameCode());
    }
    // Should generate mostly unique codes
    expect(codes.size).toBeGreaterThan(95);
  });
});

describe("generateAdminToken", () => {
  test("generates 32-character admin tokens", () => {
    const token = generateAdminToken();
    expect(token).toMatch(/^[a-z0-9]{32}$/);
    expect(token.length).toBe(32);
  });

  test("only uses lowercase letters and numbers", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateAdminToken();
      expect(token).toMatch(/^[a-z0-9]+$/);
    }
  });

  test("generates unique tokens", () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateAdminToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe("checkWinCondition", () => {
  describe("always requires full card", () => {
    test("returns false for horizontal line only", () => {
      const marked = [0, 1, 2, 3, 4];
      expect(checkWinCondition(marked, 5)).toBe(false);
    });

    test("returns false for vertical line only", () => {
      const marked = [0, 5, 10, 15, 20];
      expect(checkWinCondition(marked, 5)).toBe(false);
    });

    test("returns false for diagonal line only", () => {
      const marked = [0, 6, 12, 18, 24];
      expect(checkWinCondition(marked, 5)).toBe(false);
    });

    test("returns false for incomplete board", () => {
      const marked = Array.from({ length: 24 }, (_, i) => i); // Missing one square
      expect(checkWinCondition(marked, 5)).toBe(false);
    });

    test("returns true only when all squares are marked - various sizes", () => {
      const marked5x5 = Array.from({ length: 25 }, (_, i) => i);
      expect(checkWinCondition(marked5x5, 5)).toBe(true);

      const marked7x7 = Array.from({ length: 49 }, (_, i) => i);
      expect(checkWinCondition(marked7x7, 7)).toBe(true);
    });

    test("returns true only when all squares are marked - 3x3", () => {
      const marked = Array.from({ length: 9 }, (_, i) => i);
      expect(checkWinCondition(marked, 3)).toBe(true);
    });

    test("returns true only when all squares are marked - 4x4", () => {
      const marked = Array.from({ length: 16 }, (_, i) => i);
      expect(checkWinCondition(marked, 4)).toBe(true);
    });

    test("always requires full card", () => {
      const partial = [0, 1, 2, 3, 4];
      const full = Array.from({ length: 25 }, (_, i) => i);

      expect(checkWinCondition(partial, 5)).toBe(false);
      expect(checkWinCondition(full, 5)).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("handles empty marked positions", () => {
      expect(checkWinCondition([], 5)).toBe(false);
    });

    test("handles single marked position", () => {
      expect(checkWinCondition([12], 5)).toBe(false);
    });

    test("handles duplicate positions", () => {
      const marked = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
      // Only 5 unique positions marked, not all 25
      expect(checkWinCondition(marked, 5)).toBe(false);
    });

    test("handles positions out of order", () => {
      const marked = [4, 2, 0, 3, 1];
      // Only 5 positions marked, not all 25
      expect(checkWinCondition(marked, 5)).toBe(false);
    });
  });
});

describe("shuffleItems", () => {
  const testItems = ["A", "B", "C", "D", "E"];

  test("returns array of same length", () => {
    const shuffled = shuffleItems(testItems, "seed123");
    expect(shuffled).toHaveLength(testItems.length);
  });

  test("contains all original items", () => {
    const shuffled = shuffleItems(testItems, "seed123");
    expect(shuffled.sort()).toEqual(testItems.sort());
  });

  test("produces consistent results with same seed", () => {
    const shuffle1 = shuffleItems(testItems, "sameSeed");
    const shuffle2 = shuffleItems(testItems, "sameSeed");
    expect(shuffle1).toEqual(shuffle2);
  });

  test("produces different results with different seeds", () => {
    const shuffle1 = shuffleItems(testItems, "seed1");
    const shuffle2 = shuffleItems(testItems, "seed2");
    expect(shuffle1).not.toEqual(shuffle2);
  });

  test("does not modify original array", () => {
    const original = [...testItems];
    shuffleItems(testItems, "seed");
    expect(testItems).toEqual(original);
  });

  test("handles empty array", () => {
    expect(shuffleItems([], "seed")).toEqual([]);
  });

  test("handles single item array", () => {
    expect(shuffleItems(["A"], "seed")).toEqual(["A"]);
  });

  test("handles large arrays", () => {
    const large = Array.from({ length: 100 }, (_, i) => i);
    const shuffled = shuffleItems(large, "seed");
    expect(shuffled).toHaveLength(100);
    expect(shuffled.sort((a, b) => a - b)).toEqual(large);
  });

  test("actually shuffles items", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = shuffleItems(items, "randomSeed");
    // Check that at least some items moved
    const movedCount = items.filter(
      (item, index) => shuffled[index] !== item,
    ).length;
    expect(movedCount).toBeGreaterThan(10);
  });
});

describe("generateDummyItems", () => {
  test("generates correct number of items for 3x3 grid", () => {
    const items = generateDummyItems(3);
    expect(items).toHaveLength(9);
  });

  test("generates correct number of items for 4x4 grid", () => {
    const items = generateDummyItems(4);
    expect(items).toHaveLength(16);
  });

  test("generates correct number of items for various grid sizes", () => {
    const items5x5 = generateDummyItems(5);
    expect(items5x5).toHaveLength(25);

    const items7x7 = generateDummyItems(7);
    expect(items7x7).toHaveLength(49);

    const items2x2 = generateDummyItems(2);
    expect(items2x2).toHaveLength(4);
  });

  test("assigns sequential positions", () => {
    const items = generateDummyItems(3);
    items.forEach((item, index) => {
      expect(item.position).toBe(index);
    });
  });

  test("assigns unique IDs", () => {
    const items = generateDummyItems(5);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("uses predefined phrases when available", () => {
    const items = generateDummyItems(5);
    expect(items[0].text).toBe("Dad tells a joke");
    expect(items[1].text).toBe("Someone spills");
    expect(items[4].text).toBe("Dog barks");
  });

  test("falls back to generic text when out of phrases", () => {
    const items = generateDummyItems(5);
    // The 25th item should be generic since we have 24 phrases
    const lastItem = items[24];
    expect(lastItem.text).toBe("Awkward silence");
  });

  test("item structure is correct", () => {
    const items = generateDummyItems(3);
    items.forEach((item) => {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("text");
      expect(item).toHaveProperty("position");
      expect(typeof item.id).toBe("string");
      expect(typeof item.text).toBe("string");
      expect(typeof item.position).toBe("number");
    });
  });
});
