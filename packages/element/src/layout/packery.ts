import type { BoundingBox } from "../bounds";
import type { LayoutOptions, LayoutUnit, UnitTargetPosition } from "./types";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Checks if two rectangles intersect (strictly overlapping in area).
 */
const intersects = (a: Rect, b: Rect): boolean => {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
};

/**
 * Checks if rectangle 'inner' is completely contained within rectangle 'outer'.
 */
const isContainedIn = (inner: Rect, outer: Rect): boolean => {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
};

/**
 * 2D Bin Packing layout inspired by Metafizzy Packery, using the Maximal Rectangles (MaxRects) algorithm.
 * Packs arbitrarily sized rectangles / grouped elements tightly with configurable gap.
 */
export const calculatePackery = (
  units: readonly LayoutUnit[],
  bounds: BoundingBox,
  options: LayoutOptions,
): UnitTargetPosition[] => {
  if (units.length <= 1) {
    return units.map((unit) => ({
      unit,
      targetX: unit.box.minX,
      targetY: unit.box.minY,
    }));
  }

  const gap = Math.max(0, options.gap ?? 16);

  // Use the pre-sorted stable input order (ordered by layoutSortOrder, e.g. areaDesc)
  const sorted = [...units];

  const maxUnitWidth = Math.max(...sorted.map((u) => u.box.width));
  const totalArea = sorted.reduce(
    (acc, u) => acc + (u.box.width + gap) * (u.box.height + gap),
    0,
  );

  // Determine packing container boundary width
  let containerWidth = options.containerWidth ?? 0;
  if (containerWidth <= 0) {
    const estimatedIdealWidth = Math.max(
      maxUnitWidth + gap,
      Math.round(Math.sqrt(totalArea * 1.33)),
    );

    // If elements were originally in a single vertical column
    const isSingleColumn = bounds.width <= maxUnitWidth * 1.1;
    // If elements were originally in a single horizontal row
    const isSingleRow = bounds.width > estimatedIdealWidth * 2.5;

    if (isSingleColumn || isSingleRow) {
      containerWidth = estimatedIdealWidth;
    } else {
      containerWidth = Math.max(bounds.width, maxUnitWidth);
    }
  }

  // Initial free space: width is containerWidth, height is arbitrarily large
  let freeRects: Rect[] = [
    {
      x: 0,
      y: 0,
      width: containerWidth,
      height: 10_000_000,
    },
  ];

  let maxYReached = 0;

  const placements = sorted.map((unit) => {
    const itemWidth = unit.box.width + gap;
    const itemHeight = unit.box.height + gap;

    // Find best free rectangle slot
    // Scoring heuristic: Top-Left priority (minimize Y, then X, then best short side fit)
    let bestSlot: Rect | null = null;
    let bestScoreY = Number.POSITIVE_INFINITY;
    let bestScoreX = Number.POSITIVE_INFINITY;
    let bestShortSideFit = Number.POSITIVE_INFINITY;

    for (const free of freeRects) {
      if (free.width >= itemWidth && free.height >= itemHeight) {
        const leftoverHoriz = free.width - itemWidth;
        const leftoverVert = free.height - itemHeight;
        const shortSideFit = Math.min(leftoverHoriz, leftoverVert);

        if (
          free.y < bestScoreY ||
          (free.y === bestScoreY && free.x < bestScoreX) ||
          (free.y === bestScoreY &&
            free.x === bestScoreX &&
            shortSideFit < bestShortSideFit)
        ) {
          bestScoreY = free.y;
          bestScoreX = free.x;
          bestShortSideFit = shortSideFit;
          bestSlot = free;
        }
      }
    }

    let placedRect: Rect;

    if (bestSlot) {
      placedRect = {
        x: bestSlot.x,
        y: bestSlot.y,
        width: itemWidth,
        height: itemHeight,
      };
    } else {
      // Fallback: If no free rectangle fits, place below everything
      placedRect = {
        x: 0,
        y: maxYReached,
        width: itemWidth,
        height: itemHeight,
      };
    }

    maxYReached = Math.max(maxYReached, placedRect.y + placedRect.height);

    // Split any intersecting free rectangles
    const nextFreeRects: Rect[] = [];

    for (const free of freeRects) {
      if (!intersects(free, placedRect)) {
        nextFreeRects.push(free);
        continue;
      }

      // New top rectangle
      if (placedRect.y > free.y && placedRect.y < free.y + free.height) {
        nextFreeRects.push({
          x: free.x,
          y: free.y,
          width: free.width,
          height: placedRect.y - free.y,
        });
      }

      // New bottom rectangle
      if (
        placedRect.y + placedRect.height <
        free.y + free.height
      ) {
        nextFreeRects.push({
          x: free.x,
          y: placedRect.y + placedRect.height,
          width: free.width,
          height: free.y + free.height - (placedRect.y + placedRect.height),
        });
      }

      // New left rectangle
      if (placedRect.x > free.x && placedRect.x < free.x + free.width) {
        nextFreeRects.push({
          x: free.x,
          y: free.y,
          width: placedRect.x - free.x,
          height: free.height,
        });
      }

      // New right rectangle
      if (
        placedRect.x + placedRect.width <
        free.x + free.width
      ) {
        nextFreeRects.push({
          x: placedRect.x + placedRect.width,
          y: free.y,
          width: free.x + free.width - (placedRect.x + placedRect.width),
          height: free.height,
        });
      }
    }

    // Prune invalid and redundant rectangles
    freeRects = nextFreeRects.filter((rect, index, self) => {
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }
      // Check if rect is completely covered by another rect in self
      for (let j = 0; j < self.length; j++) {
        if (index !== j && isContainedIn(rect, self[j])) {
          return false;
        }
      }
      return true;
    });

    return {
      unit,
      targetX: bounds.minX + placedRect.x,
      targetY: bounds.minY + placedRect.y,
      placedX: placedRect.x,
    };
  });

  const maxPackedX = Math.max(
    ...placements.map((p) => p.placedX + p.unit.box.width),
  );
  let offsetX = 0;
  const alignH = options.alignHorizontal ?? "start";
  if (alignH === "center" && containerWidth > maxPackedX) {
    offsetX = (containerWidth - maxPackedX) / 2;
  } else if (alignH === "end" && containerWidth > maxPackedX) {
    offsetX = containerWidth - maxPackedX;
  }

  return placements.map((p) => ({
    unit: p.unit,
    targetX: p.targetX + offsetX,
    targetY: p.targetY,
  }));
};
