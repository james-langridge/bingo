import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameBoard } from "./GameBoard";

describe("GameBoard", () => {
  const mockItems = [
    { id: "1", text: "Item 1", position: 0 },
    { id: "2", text: "Item 2", position: 1 },
    { id: "3", text: "Item 3", position: 2 },
    { id: "4", text: "Item 4", position: 3 },
    { id: "5", text: "Item 5", position: 4 },
    { id: "6", text: "Item 6", position: 5 },
    { id: "7", text: "Item 7", position: 6 },
    { id: "8", text: "Item 8", position: 7 },
    { id: "9", text: "Item 9", position: 8 },
  ];

  const defaultProps = {
    items: mockItems,
    markedPositions: [],
    gridSize: 3,
    onItemClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    test("renders all items", () => {
      render(<GameBoard {...defaultProps} />);

      mockItems.forEach((item) => {
        expect(screen.getByText(item.text)).toBeInTheDocument();
      });
    });

    test("renders correct number of buttons", () => {
      render(<GameBoard {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(9);
    });

    test("applies responsive grid layout", () => {
      const { container } = render(<GameBoard {...defaultProps} />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveStyle({ 
        gridAutoRows: "minmax(90px, auto)",
        gridAutoFlow: "dense" 
      });
    });

    test("handles different grid sizes", () => {
      const items25 = Array.from({ length: 25 }, (_, i) => ({
        id: `${i}`,
        text: `Item ${i}`,
        position: i,
      }));

      const { container } = render(
        <GameBoard {...defaultProps} items={items25} gridSize={5} />,
      );

      const grid = container.querySelector(".grid");
      // Check that grid has responsive auto-fit columns
      expect(grid).toHaveStyle({ 
        gridAutoRows: "minmax(90px, auto)",
        gridAutoFlow: "dense" 
      });

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(25);
    });

    test("displays items in correct order", () => {
      render(<GameBoard {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button, index) => {
        expect(button).toHaveTextContent(mockItems[index].text);
      });
    });
  });

  describe("marking items", () => {
    test("applies marked styling to marked positions", () => {
      render(<GameBoard {...defaultProps} markedPositions={[0, 4, 8]} />);

      const buttons = screen.getAllByRole("button");

      // Check marked items have marked styles
      expect(buttons[0].className).toContain("from-purple-500");
      expect(buttons[0].className).toContain("to-pink-500");
      expect(buttons[4].className).toContain("from-purple-500");
      expect(buttons[8].className).toContain("from-purple-500");

      // Check unmarked items don't have marked styles
      expect(buttons[1].className).toContain("bg-white");
      expect(buttons[2].className).toContain("bg-white");
    });

    test("updates styling when marked positions change", () => {
      const { rerender } = render(
        <GameBoard {...defaultProps} markedPositions={[0]} />,
      );

      let buttons = screen.getAllByRole("button");
      expect(buttons[0].className).toContain("from-purple-500");
      expect(buttons[1].className).toContain("bg-white");

      // Update marked positions
      rerender(<GameBoard {...defaultProps} markedPositions={[1]} />);

      buttons = screen.getAllByRole("button");
      expect(buttons[0].className).toContain("bg-white");
      expect(buttons[1].className).toContain("from-purple-500");
    });

    test("handles empty marked positions", () => {
      render(<GameBoard {...defaultProps} markedPositions={[]} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.className).toContain("bg-white");
      });
    });

    test("handles all positions marked", () => {
      const allPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      render(<GameBoard {...defaultProps} markedPositions={allPositions} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.className).toContain("from-purple-500");
      });
    });
  });

  describe("interactions", () => {
    test("calls onItemClick with correct position", () => {
      const onItemClick = vi.fn();
      render(<GameBoard {...defaultProps} onItemClick={onItemClick} />);

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);

      expect(onItemClick).toHaveBeenCalledWith(0);
      expect(onItemClick).toHaveBeenCalledTimes(1);
    });

    test("handles clicks on different items", () => {
      const onItemClick = vi.fn();
      render(<GameBoard {...defaultProps} onItemClick={onItemClick} />);

      const buttons = screen.getAllByRole("button");

      fireEvent.click(buttons[2]);
      expect(onItemClick).toHaveBeenCalledWith(2);

      fireEvent.click(buttons[5]);
      expect(onItemClick).toHaveBeenCalledWith(5);

      fireEvent.click(buttons[8]);
      expect(onItemClick).toHaveBeenCalledWith(8);

      expect(onItemClick).toHaveBeenCalledTimes(3);
    });

    test("handles rapid clicks", () => {
      const onItemClick = vi.fn();
      render(<GameBoard {...defaultProps} onItemClick={onItemClick} />);

      const button = screen.getAllByRole("button")[0];

      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onItemClick).toHaveBeenCalledTimes(3);
      expect(onItemClick).toHaveBeenCalledWith(0);
    });
  });

  describe("haptic feedback", () => {
    test("triggers vibration on click when enabled", () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, "vibrate", {
        value: vibrateMock,
        writable: true,
      });

      render(<GameBoard {...defaultProps} enableHaptic={true} />);

      const button = screen.getAllByRole("button")[0];
      fireEvent.click(button);

      expect(vibrateMock).toHaveBeenCalledWith(10);
    });

    test("does not trigger vibration when disabled", () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, "vibrate", {
        value: vibrateMock,
        writable: true,
      });

      render(<GameBoard {...defaultProps} enableHaptic={false} />);

      const button = screen.getAllByRole("button")[0];
      fireEvent.click(button);

      expect(vibrateMock).not.toHaveBeenCalled();
    });

    test("enables haptic by default", () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, "vibrate", {
        value: vibrateMock,
        writable: true,
      });

      // Don't pass enableHaptic prop - should default to true
      render(
        <GameBoard
          items={mockItems}
          markedPositions={[]}
          gridSize={3}
          onItemClick={vi.fn()}
        />,
      );

      const button = screen.getAllByRole("button")[0];
      fireEvent.click(button);

      expect(vibrateMock).toHaveBeenCalledWith(10);
    });
  });

  describe("text display", () => {
    test("handles long text items", () => {
      const longTextItems = [
        {
          id: "1",
          text: "This is a very long text that should wrap properly in the button",
          position: 0,
        },
      ];

      render(
        <GameBoard {...defaultProps} items={longTextItems} gridSize={1} />,
      );

      expect(screen.getByText(longTextItems[0].text)).toBeInTheDocument();
    });

    test("handles special characters", () => {
      const specialItems = [
        { id: "1", text: "Item & Special", position: 0 },
        { id: "2", text: "Item <tag>", position: 1 },
        { id: "3", text: "Item's quote", position: 2 },
        { id: "4", text: 'Item "quoted"', position: 3 },
      ];

      render(<GameBoard {...defaultProps} items={specialItems} gridSize={2} />);

      specialItems.forEach((item) => {
        expect(screen.getByText(item.text)).toBeInTheDocument();
      });
    });

    test("handles empty text", () => {
      const emptyItems = [{ id: "1", text: "", position: 0 }];

      render(<GameBoard {...defaultProps} items={emptyItems} gridSize={1} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("styling classes", () => {
    test("applies correct base classes to buttons", () => {
      render(<GameBoard {...defaultProps} />);

      const button = screen.getAllByRole("button")[0];
      expect(button.className).toContain("min-h-[90px]");
      expect(button.className).toContain("rounded-xl");
      expect(button.className).toContain("font-medium");
    });

    test("applies hover and active states for unmarked items", () => {
      render(<GameBoard {...defaultProps} />);

      const button = screen.getAllByRole("button")[0];
      expect(button.className).toContain("hover:border-purple-300");
      expect(button.className).toContain("active:scale-95");
    });

    test("applies animation style to marked items", () => {
      render(<GameBoard {...defaultProps} markedPositions={[0]} />);

      const button = screen.getAllByRole("button")[0];
      expect(button).toHaveStyle({ animation: "pop 0.3s ease-out" });
    });

    test("does not apply animation to unmarked items", () => {
      render(<GameBoard {...defaultProps} markedPositions={[]} />);

      const button = screen.getAllByRole("button")[0];
      // Check that animation is not set (empty string or not present)
      const style = window.getComputedStyle(button);
      expect(style.animation).toBeFalsy();
    });
  });

  describe("accessibility", () => {
    test("buttons are keyboard accessible", () => {
      render(<GameBoard {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        // Buttons are keyboard accessible by default
        expect(button.tagName).toBe("BUTTON");
        expect(button).not.toHaveAttribute("disabled");
      });
    });

    test("buttons have readable text content", () => {
      render(<GameBoard {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button, index) => {
        expect(button).toHaveTextContent(mockItems[index].text);
      });
    });
  });

  describe("memoization", () => {
    test("component is memoized", () => {
      expect(GameBoard.$$typeof).toBe(Symbol.for("react.memo"));
    });
  });
});
