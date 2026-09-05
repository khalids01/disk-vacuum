import { describe, expect, test } from "bun:test";
import type { ScanTreemapNode } from "@/features/scan/api/scan-api";
import { createTreemapLayout } from "./treemap-layout";

function node(id: number, sizeBytes: number): ScanTreemapNode {
  return {
    id,
    name: `node-${id}`,
    kind: "directory",
    sizeBytes,
    category: "documents",
    groupedItemCount: 1,
  };
}

describe("createTreemapLayout", () => {
  test("preserves proportional area and stays within the workspace", () => {
    const layout = createTreemapLayout([node(1, 60), node(2, 30), node(3, 10)]);

    expect(layout).toHaveLength(3);
    expect(
      layout.reduce((total, item) => total + item.width * item.height, 0),
    ).toBeCloseTo(10_000);
    expect(layout[0].width * layout[0].height).toBeCloseTo(6_000);
    for (const item of layout) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.y).toBeGreaterThanOrEqual(0);
      expect(item.x + item.width).toBeLessThanOrEqual(100.000_001);
      expect(item.y + item.height).toBeLessThanOrEqual(100.000_001);
    }
  });

  test("omits zero-size entries from the visual geometry", () => {
    expect(createTreemapLayout([node(1, 0)])).toEqual([]);
  });
});
