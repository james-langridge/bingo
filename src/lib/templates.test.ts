import { describe, test, expect } from "vitest";
import { gameTemplates } from "./templates";

describe("gameTemplates", () => {
  test("contains expected number of templates", () => {
    expect(gameTemplates.length).toBeGreaterThanOrEqual(5);
  });

  test("all templates have required properties", () => {
    gameTemplates.forEach((template) => {
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("title");
      expect(template).toHaveProperty("description");
      expect(template).toHaveProperty("icon");
      expect(template).toHaveProperty("items");
    });
  });

  test("all template IDs are unique", () => {
    const ids = gameTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all templates have non-empty strings", () => {
    gameTemplates.forEach((template) => {
      expect(template.id).toBeTruthy();
      expect(template.title).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.icon).toBeTruthy();
      expect(typeof template.id).toBe("string");
      expect(typeof template.title).toBe("string");
      expect(typeof template.description).toBe("string");
      expect(typeof template.icon).toBe("string");
    });
  });

  test("all templates have at least 25 items for 5x5 grid", () => {
    gameTemplates.forEach((template) => {
      expect(template.items.length).toBeGreaterThanOrEqual(25);
    });
  });

  test("all template items are non-empty strings", () => {
    gameTemplates.forEach((template) => {
      template.items.forEach((item) => {
        expect(typeof item).toBe("string");
        expect(item.trim()).toBeTruthy();
      });
    });
  });

  test("no duplicate items within each template", () => {
    gameTemplates.forEach((template) => {
      const uniqueItems = new Set(template.items);
      expect(uniqueItems.size).toBe(template.items.length);
    });
  });

  describe("holiday-dinner template", () => {
    const template = gameTemplates.find((t) => t.id === "holiday-dinner");

    test("exists with correct properties", () => {
      expect(template).toBeDefined();
      expect(template?.title).toBe("Holiday Dinner");
      expect(template?.description).toBe("Classic family gathering moments");
      expect(template?.icon).toBe("🦃");
    });

    test("has appropriate holiday-themed items", () => {
      expect(template?.items).toContain("Someone arrives late");
      expect(template?.items).toContain("Wine spills");
      expect(template?.items).toContain("Burnt food");
      expect(template?.items).toContain("Political debate starts");
    });

    test("has exactly 25 items", () => {
      expect(template?.items).toHaveLength(25);
    });
  });

  describe("road-trip template", () => {
    const template = gameTemplates.find((t) => t.id === "road-trip");

    test("exists with correct properties", () => {
      expect(template).toBeDefined();
      expect(template?.title).toBe("Road Trip");
      expect(template?.description).toBe("Long drive entertainment");
      expect(template?.icon).toBe("🚗");
    });

    test("has appropriate road trip items", () => {
      expect(template?.items).toContain("Are we there yet?");
      expect(template?.items).toContain("Wrong turn taken");
      expect(template?.items).toContain("GPS recalculating");
      expect(template?.items).toContain("Traffic jam");
    });

    test("has exactly 25 items", () => {
      expect(template?.items).toHaveLength(25);
    });
  });

  describe("family-reunion template", () => {
    const template = gameTemplates.find((t) => t.id === "family-reunion");

    test("exists with correct properties", () => {
      expect(template).toBeDefined();
      expect(template?.title).toBe("Family Reunion");
      expect(template?.description).toBe("Extended family gathering");
      expect(template?.icon).toBe("👨‍👩‍👧‍👦");
    });

    test("has appropriate family reunion items", () => {
      expect(template?.items).toContain("Name forgotten");
      expect(template?.items).toContain("Dating questions");
      expect(template?.items).toContain("Height comparison");
      expect(template?.items).toContain("Family gossip");
    });

    test("has exactly 25 items", () => {
      expect(template?.items).toHaveLength(25);
    });
  });

  describe("video-call template", () => {
    const template = gameTemplates.find((t) => t.id === "video-call");

    test("exists with correct properties", () => {
      expect(template).toBeDefined();
      expect(template?.title).toBe("Video Call");
      expect(template?.description).toBe("Virtual meeting bingo");
      expect(template?.icon).toBe("💻");
    });

    test("has appropriate video call items", () => {
      expect(template?.items).toContain("Can you hear me?");
      expect(template?.items).toContain("You're on mute");
      expect(template?.items).toContain("Connection issues");
      expect(template?.items).toContain("Pet appears");
    });

    test("has exactly 25 items", () => {
      expect(template?.items).toHaveLength(25);
    });
  });

  describe("birthday-party template", () => {
    const template = gameTemplates.find((t) => t.id === "birthday-party");

    test("exists with correct properties", () => {
      expect(template).toBeDefined();
      expect(template?.title).toBe("Birthday Party");
      expect(template?.description).toBe("Birthday celebration moments");
      expect(template?.icon).toBe("🎂");
    });

    test("has appropriate birthday party items", () => {
      expect(template?.items).toContain("Candles won't light");
      expect(template?.items).toContain("Singing off-key");
      expect(template?.items).toContain("Cake mess");
      expect(template?.items).toContain("Balloon pops");
    });

    test("has exactly 25 items", () => {
      expect(template?.items).toHaveLength(25);
    });
  });

  test("template items are appropriate length for display", () => {
    gameTemplates.forEach((template) => {
      template.items.forEach((item) => {
        // Items should be reasonable length for bingo squares
        expect(item.length).toBeGreaterThan(3);
        expect(item.length).toBeLessThan(50);
      });
    });
  });

  test("templates cover diverse scenarios", () => {
    const titles = gameTemplates.map((t) => t.title);
    expect(titles).toContain("Holiday Dinner");
    expect(titles).toContain("Road Trip");
    expect(titles).toContain("Family Reunion");
    expect(titles).toContain("Video Call");
    expect(titles).toContain("Birthday Party");
  });

  test("all icons are emoji characters", () => {
    gameTemplates.forEach((template) => {
      // Basic check for emoji - should be non-empty string
      expect(template.icon).toBeTruthy();
      expect(typeof template.icon).toBe("string");
      // Emojis can vary in length due to Unicode representation
      expect(template.icon.length).toBeGreaterThanOrEqual(1);
    });
  });
});
