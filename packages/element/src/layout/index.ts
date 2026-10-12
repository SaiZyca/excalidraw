import type { AppState } from "@excalidraw/excalidraw/types";

import { updateBoundElements } from "../binding";
import { getCommonBoundingBox } from "../bounds";
import { getSelectedElementsByGroup } from "../groups";
import { getNonDeletedElements } from "../index";

import type { Scene } from "../Scene";
import type { ElementsMap, NonDeletedExcalidrawElement } from "../types";

import { calculateDistributeWithGap } from "./distributeWithGap";
import { calculateMasonry } from "./masonry";
import { calculatePackery } from "./packery";
import type { LayoutMode, LayoutOptions, LayoutUnit } from "./types";

export * from "./types";
export * from "./distributeWithGap";
export * from "./masonry";
export * from "./packery";
export * from "./frameLayout";

export const layoutElements = (
  selectedElements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  mode: LayoutMode,
  options: LayoutOptions,
  appState: Readonly<AppState>,
  scene: Scene,
): NonDeletedExcalidrawElement[] => {
  const nonDeletedSelected = getNonDeletedElements(selectedElements);
  if (nonDeletedSelected.length <= 1) {
    return nonDeletedSelected as NonDeletedExcalidrawElement[];
  }

  // Decompose selection into atomic groups or standalone elements
  const groupedElements = getSelectedElementsByGroup(
    selectedElements as NonDeletedExcalidrawElement[],
    elementsMap,
    appState,
  )
    .map(getNonDeletedElements)
    .filter((g) => g.length > 0);

  if (groupedElements.length <= 1) {
    return nonDeletedSelected as NonDeletedExcalidrawElement[];
  }

  const units: LayoutUnit[] = groupedElements.map((group) => ({
    elements: group,
    box: getCommonBoundingBox(group),
  }));

  const bounds = getCommonBoundingBox(nonDeletedSelected);
  const gap = typeof options.gap === "number" ? Math.max(0, options.gap) : 16;
  const layoutOpts: LayoutOptions = {
    ...options,
    gap,
  };

  let placements;
  switch (mode) {
    case "distributeHorizontal":
      placements = calculateDistributeWithGap(units, bounds, "x", layoutOpts);
      break;
    case "distributeVertical":
      placements = calculateDistributeWithGap(units, bounds, "y", layoutOpts);
      break;
    case "masonry":
      placements = calculateMasonry(units, bounds, layoutOpts);
      break;
    case "packery":
      placements = calculatePackery(units, bounds, layoutOpts);
      break;
    default:
      return nonDeletedSelected as NonDeletedExcalidrawElement[];
  }

  return placements.flatMap(({ unit, targetX, targetY }) => {
    const translation = {
      x: targetX - unit.box.minX,
      y: targetY - unit.box.minY,
    };

    return unit.elements.map((element) => {
      const updatedElement = scene.mutateElement(element, {
        x: element.x + translation.x,
        y: element.y + translation.y,
      });

      updateBoundElements(element, scene, {
        simultaneouslyUpdated: unit.elements,
      });

      return updatedElement;
    });
  });
};
