import type { AppState } from "@excalidraw/excalidraw/types";

import { updateBoundElements } from "../binding";
import { getCommonBoundingBox } from "../bounds";
import { getNonDeletedElements } from "../index";
import { isBoundToContainer } from "../typeChecks";
import { getBoundTextElement } from "../textElement";

import type { Scene } from "../Scene";
import type {
  ElementsMap,
  ExcalidrawFrameElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "../types";

import {
  calculateDistributeWithGap,
  calculateRowLayout,
  calculateColLayout,
} from "./distributeWithGap";
import { calculateMasonry } from "./masonry";
import { calculatePackery } from "./packery";
import type {
  FrameLayoutMode,
  FrameLayoutSortOrder,
  LayoutOptions,
  LayoutUnit,
  UnitTargetPosition,
} from "./types";

export interface FrameLayoutResult {
  frame: ExcalidrawFrameLikeElement;
  updatedChildren: NonDeletedExcalidrawElement[];
}

export const getUnitLabel = (unit: LayoutUnit): string => {
  for (const el of unit.elements) {
    if (el.type === "text" && "text" in el && typeof el.text === "string" && el.text.trim()) {
      return el.text.trim();
    }
    if (el.type === "image" && "fileId" in el && el.fileId) {
      return el.fileId;
    }
    if ("customData" in el && el.customData && typeof (el.customData as any).name === "string") {
      return (el.customData as any).name;
    }
  }
  return unit.elements[0]?.id ?? "";
};

export const sortLayoutUnits = (
  units: readonly LayoutUnit[],
  sortOrder: FrameLayoutSortOrder = "natural",
): LayoutUnit[] => {
  const list = [...units];
  switch (sortOrder) {
    case "areaDesc":
      return list.sort(
        (a, b) =>
          b.box.width * b.box.height - a.box.width * a.box.height ||
          b.elements[0].id.localeCompare(a.elements[0].id),
      );
    case "areaAsc":
      return list.sort(
        (a, b) =>
          a.box.width * a.box.height - b.box.width * b.box.height ||
          a.elements[0].id.localeCompare(b.elements[0].id),
      );
    case "widthDesc":
      return list.sort(
        (a, b) =>
          b.box.width - a.box.width ||
          b.elements[0].id.localeCompare(a.elements[0].id),
      );
    case "heightDesc":
      return list.sort(
        (a, b) =>
          b.box.height - a.box.height ||
          b.elements[0].id.localeCompare(a.elements[0].id),
      );
    case "nameAsc":
      return list.sort((a, b) => {
        const nameA = getUnitLabel(a);
        const nameB = getUnitLabel(b);
        return nameA.localeCompare(nameB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    case "natural":
    default:
      return list;
  }
};

/**
 * Groups frame children into LayoutUnits, ensuring elements belonging to the same Group
 * remain bundled together as an atomic layout unit while preserving their natural scene order.
 */
export const getFrameChildrenGroupedUnits = (
  children: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
): LayoutUnit[] => {
  const visitedGroupIds = new Set<string>();
  const units: LayoutUnit[] = [];

  for (const element of children) {
    if (isBoundToContainer(element)) {
      continue;
    }
    if (element.groupIds && element.groupIds.length > 0) {
      const rootGroupId = element.groupIds[0];
      if (visitedGroupIds.has(rootGroupId)) {
        continue;
      }
      visitedGroupIds.add(rootGroupId);
      const groupElements = children.filter(
        (el) =>
          el.groupIds &&
          el.groupIds[0] === rootGroupId &&
          !isBoundToContainer(el),
      );
      const allUnitElements: NonDeletedExcalidrawElement[] = [];
      for (const el of groupElements) {
        allUnitElements.push(el);
        const boundText = getBoundTextElement(el, elementsMap);
        if (
          boundText &&
          !boundText.isDeleted &&
          !allUnitElements.includes(boundText)
        ) {
          allUnitElements.push(boundText);
        }
      }
      units.push({
        elements: allUnitElements,
        box: getCommonBoundingBox(allUnitElements),
      });
    } else {
      const elementsInUnit: NonDeletedExcalidrawElement[] = [element];
      const boundText = getBoundTextElement(element, elementsMap);
      if (boundText && !boundText.isDeleted) {
        elementsInUnit.push(boundText);
      }
      units.push({
        elements: elementsInUnit,
        box: getCommonBoundingBox(elementsInUnit),
      });
    }
  }

  return units;
};

/**
 * Arranges children elements inside an Auto-Layout Frame using the specified
 * or configured layoutMode (distribute, masonry, packery), gap, padding, and alignments.
 */
export const layoutFrameChildren = (
  frame: ExcalidrawFrameLikeElement,
  children: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  appState: Readonly<AppState>,
  scene: Scene,
  overrides?: Partial<LayoutOptions & { layoutMode?: FrameLayoutMode }>,
): FrameLayoutResult => {
  const frameEl = frame as ExcalidrawFrameElement;
  const mode: FrameLayoutMode =
    overrides?.layoutMode ?? frameEl.layoutMode ?? "none";

  const nonDeletedChildren = getNonDeletedElements(children);

  if (mode === "none" || nonDeletedChildren.length === 0) {
    return { frame, updatedChildren: [] };
  }

  const gap =
    typeof overrides?.gap === "number"
      ? Math.max(0, overrides.gap)
      : typeof frameEl.layoutGap === "number"
      ? Math.max(0, frameEl.layoutGap)
      : 16;

  const padding =
    typeof frameEl.layoutPadding === "number"
      ? Math.max(0, frameEl.layoutPadding)
      : 16;

  const autoHeight =
    typeof frameEl.autoHeight === "boolean" ? frameEl.autoHeight : true;

  const alignHorizontal =
    overrides?.alignHorizontal ??
    frameEl.layoutAlignHorizontal ??
    "start";
  const alignVertical =
    overrides?.alignVertical ??
    frameEl.layoutAlignVertical ??
    "start";

  const sortOrder: FrameLayoutSortOrder =
    overrides?.sortOrder ??
    frameEl.layoutSortOrder ??
    (mode === "packery" ? "areaDesc" : "natural");

  const masonryFitWidth =
    typeof overrides?.masonryFitWidth === "boolean"
      ? overrides.masonryFitWidth
      : typeof frameEl.masonryFitWidth === "boolean"
      ? frameEl.masonryFitWidth
      : true;

  // Inner container boundaries available for children
  const contentStartX = frame.x + padding;
  const contentStartY = frame.y + padding;
  const containerWidth = Math.max(10, frame.width - padding * 2);
  const containerHeight = Math.max(10, frame.height - padding * 2);

  const containerBounds = {
    minX: contentStartX,
    minY: contentStartY,
    maxX: contentStartX + containerWidth,
    maxY: contentStartY + containerHeight,
    width: containerWidth,
    height: containerHeight,
    midX: contentStartX + containerWidth / 2,
    midY: contentStartY + containerHeight / 2,
  };

  // Group children into units (preserving compound groups)
  const rawUnits = getFrameChildrenGroupedUnits(nonDeletedChildren, elementsMap);

  if (rawUnits.length === 0) {
    return { frame, updatedChildren: [] };
  }

  // Sort units using deterministic sortOrder (e.g. areaDesc for packery, natural for others)
  const units = sortLayoutUnits(rawUnits, sortOrder);

  const layoutOpts: LayoutOptions = {
    gap,
    containerWidth,
    containerHeight,
    alignHorizontal,
    alignVertical,
    columns: overrides?.columns,
    sortOrder,
    masonryFitWidth,
  };

  let placements: UnitTargetPosition[];
  switch (mode) {
    case "distributeHorizontal":
      placements = calculateRowLayout(units, containerBounds, layoutOpts);
      break;
    case "distributeVertical":
      placements = calculateColLayout(units, containerBounds, layoutOpts);
      break;
    case "masonry":
      placements = calculateMasonry(units, containerBounds, layoutOpts);
      break;
    case "packery":
      placements = calculatePackery(units, containerBounds, layoutOpts);
      break;
    default:
      return { frame, updatedChildren: [] };
  }

  const updatedChildren: NonDeletedExcalidrawElement[] = [];
  let maxBottom = contentStartY;
  let maxRight = contentStartX;

  for (const { unit, targetX, targetY, targetWidth, targetHeight } of placements) {
    const scaleX =
      typeof targetWidth === "number" && unit.box.width > 0
        ? targetWidth / unit.box.width
        : 1;
    const scaleY =
      typeof targetHeight === "number" && unit.box.height > 0
        ? targetHeight / unit.box.height
        : 1;
    const isScaled = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;

    for (const element of unit.elements) {
      const relX = (element.x - unit.box.minX) * scaleX;
      const relY = (element.y - unit.box.minY) * scaleY;
      const elW = isScaled
        ? Math.max(10, Math.round(element.width * scaleX))
        : element.width;
      const elH = isScaled
        ? Math.max(10, Math.round(element.height * scaleY))
        : element.height;

      const updated = scene.mutateElement(element, {
        x: targetX + relX,
        y: targetY + relY,
        width: elW,
        height: elH,
      });

      updateBoundElements(element, scene, {
        simultaneouslyUpdated: unit.elements,
      });

      updatedChildren.push(updated);
      maxBottom = Math.max(maxBottom, updated.y + updated.height);
      maxRight = Math.max(maxRight, updated.x + updated.width);
    }
  }

  let updatedFrame = frame;
  if (autoHeight && updatedChildren.length > 0) {
    const neededHeight = Math.max(50, Math.round(maxBottom - frame.y + padding));

    // Width is strictly the constraint boundary set by the user; height adapts to fit content (hug content)
    if (neededHeight !== frame.height) {
      updatedFrame = scene.mutateElement(frame, {
        height: neededHeight,
      });
    }
  }

  return {
    frame: updatedFrame,
    updatedChildren,
  };
};
