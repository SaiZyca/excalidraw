import type { BoundingBox } from "../bounds";
import type { LayoutOptions, LayoutUnit, UnitTargetPosition } from "./types";

/**
 * Sorts units in 2D reading order (top-to-bottom, left-to-right).
 * Uses vertical overlap detection to group units into lines before sorting horizontally.
 */
const sortUnitsRowOrder = (units: readonly LayoutUnit[]): LayoutUnit[] => {
  return [...units].sort((a, b) => {
    const overlapThreshold = Math.min(a.box.height, b.box.height) * 0.5;
    if (Math.abs(a.box.minY - b.box.minY) > overlapThreshold) {
      return a.box.minY - b.box.minY;
    }
    return a.box.minX - b.box.minX;
  });
};

/**
 * Sorts units in 2D column order (left-to-right, top-to-bottom).
 * Uses horizontal overlap detection to group units into columns before sorting vertically.
 */
const sortUnitsColOrder = (units: readonly LayoutUnit[]): LayoutUnit[] => {
  return [...units].sort((a, b) => {
    const overlapThreshold = Math.min(a.box.width, b.box.width) * 0.5;
    if (Math.abs(a.box.minX - b.box.minX) > overlapThreshold) {
      return a.box.minX - b.box.minX;
    }
    return a.box.minY - b.box.minY;
  });
};

/**
 * Calculates target coordinates for horizontal (Row) layout with automatic wrapping,
 * configurable gap, and cross-axis (vertical) + main-axis (horizontal) alignment.
 */
export const calculateRowLayout = (
  units: readonly LayoutUnit[],
  bounds: BoundingBox,
  options?: LayoutOptions,
): UnitTargetPosition[] => {
  if (units.length === 0) {
    return [];
  }
  if (units.length === 1) {
    const u = units[0];
    const alignH = options?.alignHorizontal ?? "start";
    const alignV = options?.alignVertical ?? "start";
    const containerW = options?.containerWidth ?? bounds.width;
    const containerH = options?.containerHeight ?? bounds.height;

    let targetX = bounds.minX;
    if (alignH === "center" && containerW > u.box.width) {
      targetX = bounds.minX + (containerW - u.box.width) / 2;
    } else if (alignH === "end" && containerW > u.box.width) {
      targetX = bounds.minX + containerW - u.box.width;
    }

    let targetY = bounds.minY;
    if (alignV === "center" && containerH > u.box.height && containerH < 1_000_000) {
      targetY = bounds.minY + (containerH - u.box.height) / 2;
    } else if (alignV === "end" && containerH > u.box.height && containerH < 1_000_000) {
      targetY = bounds.minY + containerH - u.box.height;
    }

    return [{ unit: u, targetX, targetY }];
  }

  const gap = typeof options?.gap === "number" ? Math.max(0, options.gap) : 16;
  const containerWidth = Math.max(
    10,
    options?.containerWidth ?? bounds.width,
  );
  const alignH = options?.alignHorizontal ?? "start";
  const alignV = options?.alignVertical ?? "start";

  // If a specific sortOrder was requested (e.g. Area, Width, Height, Name),
  // preserve the deterministic pre-sorted unit order; otherwise use 2D reading order.
  const sorted =
    options?.sortOrder && options.sortOrder !== "natural"
      ? [...units]
      : sortUnitsRowOrder(units);

  // Flow wrapping into rows
  const rows: LayoutUnit[][] = [];
  let currentRow: LayoutUnit[] = [];
  let currentRowWidth = 0;

  for (const unit of sorted) {
    const unitWidth = unit.box.width;
    if (currentRow.length === 0) {
      currentRow.push(unit);
      currentRowWidth = unitWidth;
    } else {
      const nextWidth = currentRowWidth + gap + unitWidth;
      if (nextWidth <= containerWidth) {
        currentRow.push(unit);
        currentRowWidth = nextWidth;
      } else {
        rows.push(currentRow);
        currentRow = [unit];
        currentRowWidth = unitWidth;
      }
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const result: UnitTargetPosition[] = [];
  let currentY = bounds.minY;

  for (const row of rows) {
    const rowMaxHeight = Math.max(...row.map((u) => u.box.height));
    const totalRowWidth =
      row.reduce((sum, u) => sum + u.box.width, 0) + (row.length - 1) * gap;

    let startX = bounds.minX;
    if (alignH === "center" && containerWidth > totalRowWidth) {
      startX = bounds.minX + (containerWidth - totalRowWidth) / 2;
    } else if (alignH === "end" && containerWidth > totalRowWidth) {
      startX = bounds.minX + containerWidth - totalRowWidth;
    }

    let currentX = startX;
    for (const unit of row) {
      let targetY = currentY;
      if (alignV === "center") {
        targetY = currentY + (rowMaxHeight - unit.box.height) / 2;
      } else if (alignV === "end") {
        targetY = currentY + (rowMaxHeight - unit.box.height);
      }

      result.push({
        unit,
        targetX: currentX,
        targetY,
      });

      currentX += unit.box.width + gap;
    }

    currentY += rowMaxHeight + gap;
  }

  return result;
};

/**
 * Calculates target coordinates for vertical (Col) layout with column flow,
 * configurable gap, and cross-axis (horizontal) + main-axis (vertical) alignment.
 */
export const calculateColLayout = (
  units: readonly LayoutUnit[],
  bounds: BoundingBox,
  options?: LayoutOptions,
): UnitTargetPosition[] => {
  if (units.length === 0) {
    return [];
  }
  if (units.length === 1) {
    const u = units[0];
    const alignH = options?.alignHorizontal ?? "start";
    const alignV = options?.alignVertical ?? "start";
    const containerW = options?.containerWidth ?? bounds.width;
    const containerH = options?.containerHeight ?? bounds.height;

    let targetX = bounds.minX;
    if (alignH === "center" && containerW > u.box.width) {
      targetX = bounds.minX + (containerW - u.box.width) / 2;
    } else if (alignH === "end" && containerW > u.box.width) {
      targetX = bounds.minX + containerW - u.box.width;
    }

    let targetY = bounds.minY;
    if (alignV === "center" && containerH > u.box.height && containerH < 1_000_000) {
      targetY = bounds.minY + (containerH - u.box.height) / 2;
    } else if (alignV === "end" && containerH > u.box.height && containerH < 1_000_000) {
      targetY = bounds.minY + containerH - u.box.height;
    }

    return [{ unit: u, targetX, targetY }];
  }

  const gap = typeof options?.gap === "number" ? Math.max(0, options.gap) : 16;
  const containerHeight = options?.containerHeight ?? bounds.height;
  const hasBoundedHeight =
    typeof containerHeight === "number" &&
    containerHeight > 0 &&
    containerHeight < 1_000_000;

  const alignH = options?.alignHorizontal ?? "start";
  const alignV = options?.alignVertical ?? "start";

  // If a specific sortOrder was requested (e.g. Area, Width, Height, Name),
  // preserve the deterministic pre-sorted unit order; otherwise use 2D column order.
  const sorted =
    options?.sortOrder && options.sortOrder !== "natural"
      ? [...units]
      : sortUnitsColOrder(units);

  // Group into columns if container has bounded height, otherwise single column
  const cols: LayoutUnit[][] = [];
  let currentCol: LayoutUnit[] = [];
  let currentColHeight = 0;

  for (const unit of sorted) {
    const unitHeight = unit.box.height;
    if (currentCol.length === 0) {
      currentCol.push(unit);
      currentColHeight = unitHeight;
    } else if (hasBoundedHeight && currentColHeight + gap + unitHeight > containerHeight) {
      cols.push(currentCol);
      currentCol = [unit];
      currentColHeight = unitHeight;
    } else {
      currentCol.push(unit);
      currentColHeight += gap + unitHeight;
    }
  }
  if (currentCol.length > 0) {
    cols.push(currentCol);
  }

  const result: UnitTargetPosition[] = [];
  let currentX = bounds.minX;

  for (const col of cols) {
    const colMaxWidth = Math.max(...col.map((u) => u.box.width));
    const totalColHeight =
      col.reduce((sum, u) => sum + u.box.height, 0) + (col.length - 1) * gap;

    let startY = bounds.minY;
    if (hasBoundedHeight) {
      if (alignV === "center" && containerHeight > totalColHeight) {
        startY = bounds.minY + (containerHeight - totalColHeight) / 2;
      } else if (alignV === "end" && containerHeight > totalColHeight) {
        startY = bounds.minY + containerHeight - totalColHeight;
      }
    }

    let currentY = startY;
    for (const unit of col) {
      let targetX = currentX;
      if (alignH === "center") {
        targetX = currentX + (colMaxWidth - unit.box.width) / 2;
      } else if (alignH === "end") {
        targetX = currentX + (colMaxWidth - unit.box.width);
      }

      result.push({
        unit,
        targetX,
        targetY: currentY,
      });

      currentY += unit.box.height + gap;
    }

    currentX += colMaxWidth + gap;
  }

  return result;
};

/**
 * Calculates target coordinates for horizontal or vertical distribution
 * with a fixed, configurable gap between elements. Backward-compatible wrapper.
 */
export const calculateDistributeWithGap = (
  units: readonly LayoutUnit[],
  bounds: BoundingBox,
  axis: "x" | "y",
  optionsOrGap: number | LayoutOptions,
): UnitTargetPosition[] => {
  const options: LayoutOptions =
    typeof optionsOrGap === "number"
      ? { gap: optionsOrGap }
      : optionsOrGap ?? {};

  if (axis === "x") {
    return calculateRowLayout(units, bounds, options);
  }

  return calculateColLayout(units, bounds, options);
};
