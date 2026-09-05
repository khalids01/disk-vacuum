import type { ScanTreemapNode } from "@/features/scan/api/scan-api";

export interface TreemapRectangle {
  node: ScanTreemapNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WeightedNode {
  node: ScanTreemapNode;
  area: number;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createTreemapLayout(
  nodes: ScanTreemapNode[],
  width = 100,
  height = 100,
): TreemapRectangle[] {
  const positiveNodes = nodes.filter((node) => node.sizeBytes > 0);
  const totalSize = positiveNodes.reduce(
    (total, node) => total + node.sizeBytes,
    0,
  );
  if (totalSize <= 0 || width <= 0 || height <= 0) return [];

  const scale = (width * height) / totalSize;
  const remaining: Rectangle = { x: 0, y: 0, width, height };
  const weighted = positiveNodes.map((node) => ({
    node,
    area: node.sizeBytes * scale,
  }));
  const rectangles: TreemapRectangle[] = [];
  let row: WeightedNode[] = [];

  while (weighted.length > 0) {
    const candidate = weighted[0];
    const side = Math.min(remaining.width, remaining.height);
    if (
      row.length === 0 ||
      worstAspectRatio([...row, candidate], side) <= worstAspectRatio(row, side)
    ) {
      row.push(candidate);
      weighted.shift();
      continue;
    }
    layoutRow(row, remaining, rectangles);
    row = [];
  }

  if (row.length > 0) layoutRow(row, remaining, rectangles);
  return rectangles;
}

function worstAspectRatio(row: WeightedNode[], side: number) {
  if (row.length === 0 || side <= 0) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((total, item) => total + item.area, 0);
  const largest = Math.max(...row.map((item) => item.area));
  const smallest = Math.min(...row.map((item) => item.area));
  const sideSquared = side * side;
  const sumSquared = sum * sum;
  return Math.max(
    (sideSquared * largest) / sumSquared,
    sumSquared / (sideSquared * smallest),
  );
}

function layoutRow(
  row: WeightedNode[],
  remaining: Rectangle,
  output: TreemapRectangle[],
) {
  const rowArea = row.reduce((total, item) => total + item.area, 0);
  if (remaining.width >= remaining.height) {
    const rowWidth = remaining.height > 0 ? rowArea / remaining.height : 0;
    let y = remaining.y;
    for (const item of row) {
      const itemHeight = rowWidth > 0 ? item.area / rowWidth : 0;
      output.push({
        node: item.node,
        x: remaining.x,
        y,
        width: rowWidth,
        height: itemHeight,
      });
      y += itemHeight;
    }
    remaining.x += rowWidth;
    remaining.width = Math.max(0, remaining.width - rowWidth);
    return;
  }

  const rowHeight = remaining.width > 0 ? rowArea / remaining.width : 0;
  let x = remaining.x;
  for (const item of row) {
    const itemWidth = rowHeight > 0 ? item.area / rowHeight : 0;
    output.push({
      node: item.node,
      x,
      y: remaining.y,
      width: itemWidth,
      height: rowHeight,
    });
    x += itemWidth;
  }
  remaining.y += rowHeight;
  remaining.height = Math.max(0, remaining.height - rowHeight);
}
