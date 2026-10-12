import type { BoundingBox } from "../bounds";
import type { LayoutOptions, LayoutUnit, UnitTargetPosition } from "./types";

/**
 * Calculates target coordinates for multi-column Masonry (waterfall) layout.
 * Elements are placed into the column with the lowest accumulated height,
 * with uniform horizontal and vertical gaps.
 */
export const calculateMasonry = (
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
  const fitWidth = options.masonryFitWidth !== false;

  // Use the pre-sorted stable input order (no dynamic sorting on coordinates)
  const sorted = [...units];

  const totalUnits = sorted.length;
  const avgWidth =
    sorted.reduce((acc, u) => acc + u.box.width, 0) / totalUnits;
  const maxWidth = Math.max(...sorted.map((u) => u.box.width));

  // Determine container width
  let containerWidth = options.containerWidth ?? bounds.width;

  // Determine number of columns
  let columns = options.columns ?? 0;
  if (columns <= 0) {
    // If children have an average width, use that as the basis for ideal column width,
    // clamped between a reasonable minimum (80px) and containerWidth.
    const idealColWidth = avgWidth > 0 ? Math.min(containerWidth, Math.max(80, Math.round(avgWidth))) : 200;
    const estimatedCols = Math.round((containerWidth + gap) / (idealColWidth + gap));
    columns = Math.max(1, Math.min(estimatedCols, totalUnits));
  }
  columns = Math.max(1, Math.min(totalUnits, columns));

  // If container fits multiple columns, divide containerWidth across columns.
  // BUT if there is only 1 column (or if colWidth calculated from containerWidth would be
  // much larger than the average child width, e.g. single item in wide frame),
  // cap colWidth so it doesn't artificially stretch the object to fill the entire wide frame!
  let colWidth = Math.max(
    20,
    (containerWidth - (columns - 1) * gap) / columns,
  );

  // When fitWidth is active, if the calculated column width is unreasonably larger than
  // the children's dimensions (e.g. 1 or 2 items in a huge frame), cap colWidth to avgWidth or maxWidth
  // to avoid ballooning small items to frame width.
  if (avgWidth > 0 && colWidth > avgWidth * 1.5 && columns < totalUnits) {
    // There's enough container width for more columns than currently estimated
    const moreCols = Math.min(
      totalUnits,
      Math.max(1, Math.floor((containerWidth + gap) / (avgWidth + gap))),
    );
    if (moreCols > columns) {
      columns = moreCols;
      colWidth = Math.max(20, (containerWidth - (columns - 1) * gap) / columns);
    }
  }

  // If even with max columns, colWidth still drastically exceeds the children's max width
  // (e.g. only 1 item in a 1000px wide frame), don't force it to 1000px. Cap it to maxWidth (or avgWidth).
  if (columns === totalUnits && maxWidth > 0 && colWidth > maxWidth) {
    colWidth = Math.max(20, Math.round(avgWidth));
  }

  const totalMasonryWidth = columns * colWidth + (columns - 1) * gap;
  let startX = bounds.minX;
  const alignH = options.alignHorizontal ?? "start";
  if (alignH === "center" && containerWidth > totalMasonryWidth) {
    startX = bounds.minX + (containerWidth - totalMasonryWidth) / 2;
  } else if (alignH === "end" && containerWidth > totalMasonryWidth) {
    startX = bounds.minX + containerWidth - totalMasonryWidth;
  }

  const startY = bounds.minY;

  // Track height of each column
  const colHeights = new Array(columns).fill(0);

  return sorted.map((unit) => {
    // Find column with minimum height
    let shortestColIdx = 0;
    let minH = colHeights[0];
    for (let c = 1; c < columns; c++) {
      if (colHeights[c] < minH) {
        minH = colHeights[c];
        shortestColIdx = c;
      }
    }

    const colX = startX + shortestColIdx * (colWidth + gap);
    const targetY = startY + colHeights[shortestColIdx];

    if (fitWidth && unit.box.width > 0) {
      const scaledHeight = Math.max(
        10,
        Math.round(unit.box.height * (colWidth / unit.box.width)),
      );
      colHeights[shortestColIdx] += scaledHeight + gap;

      return {
        unit,
        targetX: colX,
        targetY,
        targetWidth: colWidth,
        targetHeight: scaledHeight,
      };
    }

    let targetX = colX;
    if (unit.box.width < colWidth) {
      if (alignH === "center") {
        targetX += (colWidth - unit.box.width) / 2;
      } else if (alignH === "end") {
        targetX += colWidth - unit.box.width;
      }
    }

    colHeights[shortestColIdx] += unit.box.height + gap;

    return {
      unit,
      targetX,
      targetY,
    };
  });
};
