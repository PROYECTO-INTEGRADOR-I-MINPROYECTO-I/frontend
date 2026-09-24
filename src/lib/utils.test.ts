import { describe, expect, it } from "vitest";
import { getRowClassName } from "./utils";

describe("getRowClassName", () => {
  it("adds the selected class when the row is selected", () => {
    const result = getRowClassName({ isSelected: true });

    expect(result).toContain("bg-muted");
  });

  it("adds the correct optimistic class", () => {
    const result = getRowClassName({
      isSelected: false,
      optimisticOperation: "create",
    });

    expect(result).toContain("animate-highlight");
    expect(result).toContain("from-green-300");
  });
});