import { randomId } from "@excalidraw/common";
import {
  addElementsToFrame,
  CaptureUpdateAction,
  getCommonBounds,
  getElementsInGroup,
  getFrameChildren,
  getNonDeletedElements,
  isFrameLikeElement,
  isImageElement,
  getUncroppedWidthAndHeight,
  layoutFrameChildren,
  mutateElement,
  newFrameElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  FrameLayoutMode,
  FrameLayoutAlignHorizontal,
  FrameLayoutAlignVertical,
  FrameLayoutSortOrder,
} from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";
import { register } from "./register";
import type { AppClassProperties, AppState, UIAppState } from "../types";

const isSingleFrameSelected = (
  appState: UIAppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  return (
    selectedElements.length === 1 && isFrameLikeElement(selectedElements[0])
  );
};

const getSelectedFrame = (
  appState: Readonly<AppState>,
  app: AppClassProperties,
): ExcalidrawFrameElement | null => {
  const selectedElements = app.scene.getSelectedElements(appState);
  if (
    selectedElements.length === 1 &&
    isFrameLikeElement(selectedElements[0])
  ) {
    return selectedElements[0] as ExcalidrawFrameElement;
  }
  return null;
};

const canWrapSelectionInFrame = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
) => {
  const selectedElements = getSelectedElements(elements, appState);
  return (
    selectedElements.length > 0 &&
    !selectedElements.some((element) => isFrameLikeElement(element))
  );
};

const changeSelectedFrameLayoutMode = (
  mode: FrameLayoutMode,
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  if (!frame) {
    return false;
  }

  app.scene.mutateElement(frame, { layoutMode: mode });

  if (mode !== "none") {
    const children = getNonDeletedElements(
      getFrameChildren(elements, frame.id),
    );
    layoutFrameChildren(
      frame,
      children,
      app.scene.getNonDeletedElementsMap(),
      appState,
      app.scene,
      { layoutMode: mode },
    );
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const changeSelectedFrameLayoutAlignment = (
  align: {
    alignHorizontal?: FrameLayoutAlignHorizontal;
    alignVertical?: FrameLayoutAlignVertical;
  },
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  if (!frame) {
    return false;
  }

  app.scene.mutateElement(frame, {
    ...(align.alignHorizontal && { layoutAlignHorizontal: align.alignHorizontal }),
    ...(align.alignVertical && { layoutAlignVertical: align.alignVertical }),
  });

  const children = getNonDeletedElements(
    getFrameChildren(elements, frame.id),
  );
  if (children.length > 0) {
    layoutFrameChildren(
      frame,
      children,
      app.scene.getNonDeletedElementsMap(),
      appState,
      app.scene,
      {
        alignHorizontal: align.alignHorizontal ?? frame.layoutAlignHorizontal,
        alignVertical: align.alignVertical ?? frame.layoutAlignVertical,
      },
    );
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const convertFrameToGroup = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  if (!frame) {
    return false;
  }
  const children = getNonDeletedElements(
    getFrameChildren(elements, frame.id),
  );

  if (children.length === 0) {
    app.scene.mutateElement(frame, { isDeleted: true });
    return {
      elements,
      appState: {
        ...appState,
        selectedElementIds: {},
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  }

  const newGroupId = randomId();
  const nextSelectedElementIds: Record<string, true> = {};

  for (const child of children) {
    const existingGroupIds = child.groupIds || [];
    app.scene.mutateElement(child, {
      frameId: null,
      groupIds: [newGroupId, ...existingGroupIds],
    });
    nextSelectedElementIds[child.id] = true;
  }

  // Mark frame as deleted
  app.scene.mutateElement(frame, { isDeleted: true });

  return {
    elements,
    appState: {
      ...appState,
      selectedElementIds: nextSelectedElementIds,
      selectedGroupIds: { [newGroupId]: true },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const wrapSelectionInAutoLayoutFrame = (
  mode: FrameLayoutMode,
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const selectedElements = getSelectedElements(elements, appState);
  if (selectedElements.length === 0) {
    return false;
  }
  const elementsMap = app.scene.getNonDeletedElementsMap();

  const [x1, y1, x2, y2] = getCommonBounds(selectedElements, elementsMap);
  const PADDING = 16;
  const GAP = 16;
  const frame = newFrameElement({
    x: x1 - PADDING,
    y: y1 - PADDING,
    width: Math.max(100, x2 - x1 + PADDING * 2),
    height: Math.max(100, y2 - y1 + PADDING * 2),
    layoutMode: mode,
    layoutGap: GAP,
    layoutPadding: PADDING,
    autoHeight: true,
  });

  // Dissolve groups so all elements become individual items inside the frame
  for (const element of selectedElements) {
    if (element.groupIds && element.groupIds.length > 0) {
      mutateElement(element, elementsMap, {
        groupIds: [],
      });
    }
  }

  const nextElements = addElementsToFrame(
    [...app.scene.getElementsIncludingDeleted(), frame],
    selectedElements,
    frame,
  );

  layoutFrameChildren(
    frame,
    getNonDeletedElements(selectedElements),
    app.scene.getNonDeletedElementsMap(),
    appState,
    app.scene,
    { layoutMode: mode, gap: GAP },
  );

  return {
    elements: nextElements,
    appState: {
      ...appState,
      selectedGroupIds: {},
      editingGroupId: null,
      selectedElementIds: { [frame.id]: true as const },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

// --- Actions for setting frame layout mode on selected frame ---

export const actionSetFrameLayoutNone = register({
  name: "setFrameLayoutNone",
  label: "labels.frameLayoutNone",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutMode("none", elements, appState, app),
});

export const actionSetFrameLayoutHorizontal = register({
  name: "setFrameLayoutHorizontal",
  label: "labels.frameLayoutHorizontal",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutMode(
      "distributeHorizontal",
      elements,
      appState,
      app,
    ),
});

export const actionSetFrameLayoutVertical = register({
  name: "setFrameLayoutVertical",
  label: "labels.frameLayoutVertical",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutMode(
      "distributeVertical",
      elements,
      appState,
      app,
    ),
});

export const actionSetFrameLayoutMasonry = register({
  name: "setFrameLayoutMasonry",
  label: "labels.frameLayoutMasonry",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutMode("masonry", elements, appState, app),
});

export const actionSetFrameLayoutPackery = register({
  name: "setFrameLayoutPackery",
  label: "labels.frameLayoutPackery",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutMode("packery", elements, appState, app),
});

// --- Actions for Frame Alignments ---

export const actionSetFrameLayoutAlignLeft = register({
  name: "setFrameLayoutAlignLeft",
  label: "labels.alignLeft",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutAlignment(
      { alignHorizontal: "start" },
      elements,
      appState,
      app,
    ),
});

export const actionSetFrameLayoutAlignHorizontallyCentered = register({
  name: "setFrameLayoutAlignHorizontallyCentered",
  label: "labels.centerHorizontally",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutAlignment(
      { alignHorizontal: "center" },
      elements,
      appState,
      app,
    ),
});

export const actionSetFrameLayoutAlignRight = register({
  name: "setFrameLayoutAlignRight",
  label: "labels.alignRight",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutAlignment(
      { alignHorizontal: "end" },
      elements,
      appState,
      app,
    ),
});

export const actionSetFrameLayoutAlignTop = register({
  name: "setFrameLayoutAlignTop",
  label: "labels.alignTop",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutAlignment(
      { alignVertical: "start" },
      elements,
      appState,
      app,
    ),
});

export const actionSetFrameLayoutAlignVerticallyCentered = register({
  name: "setFrameLayoutAlignVerticallyCentered",
  label: "labels.centerVertically",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutAlignment(
      { alignVertical: "center" },
      elements,
      appState,
      app,
    ),
});

export const actionSetFrameLayoutAlignBottom = register({
  name: "setFrameLayoutAlignBottom",
  label: "labels.alignBottom",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutAlignment(
      { alignVertical: "end" },
      elements,
      appState,
      app,
    ),
});

// --- Actions for Frame <-> Group conversion ---

export const actionConvertFrameToGroup = register({
  name: "convertFrameToGroup",
  label: "labels.convertFrameToGroup",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    convertFrameToGroup(elements, appState, app),
});

export const actionConvertGroupToFrame = register({
  name: "convertGroupToFrame",
  label: "labels.convertGroupToFrame",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => canWrapSelectionInFrame(elements, appState),
  perform: (elements, appState, _, app) =>
    wrapSelectionInAutoLayoutFrame("none", elements, appState, app),
});

// --- Actions for wrapping selection into Auto-Layout Frame ---

export const actionWrapInAutoLayoutFrameHorizontal = register({
  name: "wrapInAutoLayoutFrameHorizontal",
  label: "labels.frameLayoutHorizontal",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => canWrapSelectionInFrame(elements, appState),
  perform: (elements, appState, _, app) =>
    wrapSelectionInAutoLayoutFrame(
      "distributeHorizontal",
      elements,
      appState,
      app,
    ),
});

export const actionWrapInAutoLayoutFrameVertical = register({
  name: "wrapInAutoLayoutFrameVertical",
  label: "labels.frameLayoutVertical",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => canWrapSelectionInFrame(elements, appState),
  perform: (elements, appState, _, app) =>
    wrapSelectionInAutoLayoutFrame(
      "distributeVertical",
      elements,
      appState,
      app,
    ),
});

export const actionWrapInAutoLayoutFrameMasonry = register({
  name: "wrapInAutoLayoutFrameMasonry",
  label: "labels.frameLayoutMasonry",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => canWrapSelectionInFrame(elements, appState),
  perform: (elements, appState, _, app) =>
    wrapSelectionInAutoLayoutFrame("masonry", elements, appState, app),
});

export const actionWrapInAutoLayoutFramePackery = register({
  name: "wrapInAutoLayoutFramePackery",
  label: "labels.frameLayoutPackery",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => canWrapSelectionInFrame(elements, appState),
  perform: (elements, appState, _, app) =>
    wrapSelectionInAutoLayoutFrame("packery", elements, appState, app),
});

// --- Sort Order Helpers and Actions ---

const changeSelectedFrameLayoutSortOrder = (
  sortOrder: FrameLayoutSortOrder,
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  if (!frame) {
    return false;
  }

  app.scene.mutateElement(frame, { layoutSortOrder: sortOrder });

  const children = getNonDeletedElements(
    getFrameChildren(elements, frame.id),
  );
  if (children.length > 0) {
    layoutFrameChildren(
      frame,
      children,
      app.scene.getNonDeletedElementsMap(),
      appState,
      app.scene,
      { sortOrder },
    );
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

export const actionSetFrameLayoutSortNatural = register({
  name: "setFrameLayoutSortNatural",
  label: "labels.frameLayoutSortNatural",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutSortOrder("natural", elements, appState, app),
});

export const actionSetFrameLayoutSortAreaDesc = register({
  name: "setFrameLayoutSortAreaDesc",
  label: "labels.frameLayoutSortAreaDesc",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutSortOrder("areaDesc", elements, appState, app),
});

export const actionSetFrameLayoutSortAreaAsc = register({
  name: "setFrameLayoutSortAreaAsc",
  label: "labels.frameLayoutSortAreaAsc",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutSortOrder("areaAsc", elements, appState, app),
});

export const actionSetFrameLayoutSortWidthDesc = register({
  name: "setFrameLayoutSortWidthDesc",
  label: "labels.frameLayoutSortWidthDesc",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutSortOrder("widthDesc", elements, appState, app),
});

export const actionSetFrameLayoutSortHeightDesc = register({
  name: "setFrameLayoutSortHeightDesc",
  label: "labels.frameLayoutSortHeightDesc",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutSortOrder("heightDesc", elements, appState, app),
});

export const actionSetFrameLayoutSortNameAsc = register({
  name: "setFrameLayoutSortNameAsc",
  label: "labels.frameLayoutSortNameAsc",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    changeSelectedFrameLayoutSortOrder("nameAsc", elements, appState, app),
});

// --- Crop & Sizing Helpers and Actions ---

const cropSelectedFrameImagesSquare = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const targetElements = frame
    ? getNonDeletedElements(getFrameChildren(elements, frame.id))
    : getSelectedElements(elements, appState);

  let modified = false;
  for (const el of targetElements) {
    if (isImageElement(el)) {
      const cachedImage = el.fileId
        ? (app.imageCache.get(el.fileId)?.image as
            | HTMLImageElement
            | undefined)
        : undefined;
      const naturalWidth =
        el.crop?.naturalWidth ?? cachedImage?.naturalWidth ?? el.width;
      const naturalHeight =
        el.crop?.naturalHeight ?? cachedImage?.naturalHeight ?? el.height;

      const minSide = Math.min(naturalWidth, naturalHeight);
      const cropX = Math.round((naturalWidth - minSide) / 2);
      const cropY = Math.round((naturalHeight - minSide) / 2);
      const targetSide = Math.min(el.width, el.height);

      app.scene.mutateElement(el, {
        crop: {
          x: cropX,
          y: cropY,
          width: minSide,
          height: minSide,
          naturalWidth,
          naturalHeight,
        },
        width: targetSide,
        height: targetSide,
      });
      modified = true;
    }
  }

  if (frame && modified) {
    const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
    layoutFrameChildren(frame, children, elementsMap, appState, app.scene);
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const resetSelectedFrameImagesCrop = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const targetElements = frame
    ? getNonDeletedElements(getFrameChildren(elements, frame.id))
    : getSelectedElements(elements, appState);

  let modified = false;
  for (const el of targetElements) {
    if (isImageElement(el) && el.crop) {
      const { width, height } = getUncroppedWidthAndHeight(el);
      app.scene.mutateElement(el, {
        crop: null,
        width,
        height,
      });
      modified = true;
    }
  }

  if (frame && modified) {
    const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
    layoutFrameChildren(frame, children, elementsMap, appState, app.scene);
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const resetSelectedFrameImagesAspectRatio = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const targetElements = frame
    ? getNonDeletedElements(getFrameChildren(elements, frame.id))
    : getSelectedElements(elements, appState);

  let modified = false;
  for (const el of targetElements) {
    if (isImageElement(el)) {
      const cachedImage = el.fileId
        ? (app.imageCache.get(el.fileId)?.image as
            | HTMLImageElement
            | undefined)
        : undefined;
      const naturalWidth =
        el.crop?.naturalWidth ?? cachedImage?.naturalWidth ?? el.width;
      const naturalHeight =
        el.crop?.naturalHeight ?? cachedImage?.naturalHeight ?? el.height;

      const targetRatio =
        el.crop && el.crop.width > 0 && el.crop.height > 0
          ? el.crop.width / el.crop.height
          : naturalWidth > 0 && naturalHeight > 0
          ? naturalWidth / naturalHeight
          : 1;

      // Preserve the smaller dimension so elements don't suddenly become enormous
      let newWidth = el.width;
      let newHeight = el.height;

      if (targetRatio >= 1) {
        // Landscape or square: fix height, compute width
        newHeight = el.height;
        newWidth = Math.max(10, Math.round(newHeight * targetRatio));
        // If calculated width is larger than previous width, scale down by min side instead
        if (newWidth > el.width && el.width > 0) {
          newWidth = el.width;
          newHeight = Math.max(10, Math.round(newWidth / targetRatio));
        }
      } else {
        // Portrait: fix width, compute height
        newWidth = el.width;
        newHeight = Math.max(10, Math.round(newWidth / targetRatio));
        if (newHeight > el.height && el.height > 0) {
          newHeight = el.height;
          newWidth = Math.max(10, Math.round(newHeight * targetRatio));
        }
      }

      if (Math.round(newWidth) !== Math.round(el.width) || Math.round(newHeight) !== Math.round(el.height)) {
        app.scene.mutateElement(el, {
          width: newWidth,
          height: newHeight,
        });
        modified = true;
      }
    }
  }

  if (frame && modified) {
    const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
    layoutFrameChildren(frame, children, elementsMap, appState, app.scene);
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const resetSelectedFrameImagesOriginalResolution = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const targetElements = frame
    ? getNonDeletedElements(getFrameChildren(elements, frame.id))
    : getSelectedElements(elements, appState);

  let modified = false;
  for (const el of targetElements) {
    if (isImageElement(el)) {
      const cachedImage = el.fileId
        ? (app.imageCache.get(el.fileId)?.image as
            | HTMLImageElement
            | undefined)
        : undefined;
      const naturalWidth =
        el.crop?.naturalWidth ?? cachedImage?.naturalWidth ?? el.width;
      const naturalHeight =
        el.crop?.naturalHeight ?? cachedImage?.naturalHeight ?? el.height;

      let targetWidth = naturalWidth;
      let targetHeight = naturalHeight;

      if (el.crop && el.crop.width > 0 && el.crop.height > 0) {
        targetWidth = el.crop.width;
        targetHeight = el.crop.height;
      }

      if (Math.round(el.width) !== Math.round(targetWidth) || Math.round(el.height) !== Math.round(targetHeight)) {
        app.scene.mutateElement(el, {
          width: targetWidth,
          height: targetHeight,
        });
        modified = true;
      }
    }
  }

  if (frame && modified) {
    const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
    layoutFrameChildren(frame, children, elementsMap, appState, app.scene);
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const unifySelectedFrameElementsWidth = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const targetElements = frame
    ? getNonDeletedElements(getFrameChildren(elements, frame.id))
    : getSelectedElements(elements, appState);

  if (targetElements.length < 2) {
    return false;
  }

  const targetWidth = targetElements[0].width;

  for (const el of targetElements) {
    if (el.width > 0) {
      const newHeight = Math.max(
        10,
        Math.round(el.height * (targetWidth / el.width)),
      );
      app.scene.mutateElement(el, {
        width: targetWidth,
        height: newHeight,
      });
    }
  }

  if (frame) {
    const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
    layoutFrameChildren(frame, children, elementsMap, appState, app.scene);
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const unifySelectedFrameElementsHeight = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const targetElements = frame
    ? getNonDeletedElements(getFrameChildren(elements, frame.id))
    : getSelectedElements(elements, appState);

  if (targetElements.length < 2) {
    return false;
  }

  const padding =
    frame && typeof frame.layoutPadding === "number"
      ? Math.max(0, frame.layoutPadding)
      : 16;
  const maxAllowedWidth = frame ? Math.max(50, frame.width - padding * 2) : 10000;

  let targetHeight = targetElements[0].height;

  // If inside a frame, ensure unifying height doesn't cause any element's proportional width to exceed container width!
  for (const el of targetElements) {
    if (el.height > 0) {
      const projectedWidth = el.width * (targetHeight / el.height);
      if (projectedWidth > maxAllowedWidth) {
        targetHeight = Math.max(10, Math.floor(el.height * (maxAllowedWidth / el.width)));
      }
    }
  }

  for (const el of targetElements) {
    if (el.height > 0) {
      const newWidth = Math.max(
        10,
        Math.round(el.width * (targetHeight / el.height)),
      );
      app.scene.mutateElement(el, {
        width: newWidth,
        height: targetHeight,
      });
    }
  }

  if (frame) {
    const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
    layoutFrameChildren(frame, children, elementsMap, appState, app.scene);
  }

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

const freezeSelectedFrameLayoutOrder = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  if (!frame) {
    return false;
  }

  const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
  if (children.length <= 1) {
    return false;
  }

  // Sort children by visual position (Y first, then X)
  const sortedChildren = [...children].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > 16) {
      return dy;
    }
    return a.x - b.x;
  });

  // Reorder them in scene elements to lock in the layer order
  const allElements = [...app.scene.getElementsIncludingDeleted()];
  const childIds = new Set(sortedChildren.map((c) => c.id));
  const otherElements = allElements.filter((el) => !childIds.has(el.id));
  const frameIdx = otherElements.findIndex((el) => el.id === frame.id);

  const newElementsList = [
    ...otherElements.slice(0, frameIdx + 1),
    ...sortedChildren,
    ...otherElements.slice(frameIdx + 1),
  ];

  app.scene.mutateElement(frame, { layoutSortOrder: "natural" });
  app.scene.replaceAllElements(newElementsList);

  layoutFrameChildren(
    frame,
    sortedChildren,
    app.scene.getNonDeletedElementsMap(),
    appState,
    app.scene,
    { sortOrder: "natural" },
  );

  return {
    elements: newElementsList,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

export const actionCropImagesSquare = register({
  name: "cropImagesSquare",
  label: "labels.cropImagesSquare",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const frame = getSelectedFrame(appState, app);
    if (frame) {
      const children = getNonDeletedElements(
        getFrameChildren(elements, frame.id),
      );
      return children.some((c) => isImageElement(c));
    }
    const selected = getSelectedElements(elements, appState);
    return selected.length > 0 && selected.some((c) => isImageElement(c));
  },
  perform: (elements, appState, _, app) =>
    cropSelectedFrameImagesSquare(elements, appState, app),
});

export const actionResetImagesCrop = register({
  name: "resetImagesCrop",
  label: "labels.resetImagesCrop",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const frame = getSelectedFrame(appState, app);
    if (frame) {
      const children = getNonDeletedElements(
        getFrameChildren(elements, frame.id),
      );
      return children.some((c) => isImageElement(c) && c.crop !== null);
    }
    const selected = getSelectedElements(elements, appState);
    return selected.some((c) => isImageElement(c) && c.crop !== null);
  },
  perform: (elements, appState, _, app) =>
    resetSelectedFrameImagesCrop(elements, appState, app),
});

export const actionResetImageAspectRatio = register({
  name: "resetImageAspectRatio",
  label: "labels.resetImageAspectRatio",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const frame = getSelectedFrame(appState, app);
    if (frame) {
      const children = getNonDeletedElements(
        getFrameChildren(elements, frame.id),
      );
      return children.some((c) => isImageElement(c));
    }
    const selected = getSelectedElements(elements, appState);
    return selected.some((c) => isImageElement(c));
  },
  perform: (elements, appState, _, app) =>
    resetSelectedFrameImagesAspectRatio(elements, appState, app),
});

export const actionResetImageOriginalResolution = register({
  name: "resetImageOriginalResolution",
  label: "labels.resetImageOriginalResolution",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const frame = getSelectedFrame(appState, app);
    if (frame) {
      const children = getNonDeletedElements(
        getFrameChildren(elements, frame.id),
      );
      return children.some((c) => isImageElement(c));
    }
    const selected = getSelectedElements(elements, appState);
    return selected.some((c) => isImageElement(c));
  },
  perform: (elements, appState, _, app) =>
    resetSelectedFrameImagesOriginalResolution(elements, appState, app),
});

export const actionUnifyElementsWidth = register({
  name: "unifyElementsWidth",
  label: "labels.unifyElementsWidth",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const frame = getSelectedFrame(appState, app);
    if (frame) {
      return (
        getNonDeletedElements(getFrameChildren(elements, frame.id)).length >= 2
      );
    }
    return getSelectedElements(elements, appState).length >= 2;
  },
  perform: (elements, appState, _, app) =>
    unifySelectedFrameElementsWidth(elements, appState, app),
});

export const actionUnifyElementsHeight = register({
  name: "unifyElementsHeight",
  label: "labels.unifyElementsHeight",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const frame = getSelectedFrame(appState, app);
    if (frame) {
      return (
        getNonDeletedElements(getFrameChildren(elements, frame.id)).length >= 2
      );
    }
    return getSelectedElements(elements, appState).length >= 2;
  },
  perform: (elements, appState, _, app) =>
    unifySelectedFrameElementsHeight(elements, appState, app),
});

export const actionFreezeFrameLayoutOrder = register({
  name: "freezeFrameLayoutOrder",
  label: "labels.freezeFrameLayoutOrder",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    freezeSelectedFrameLayoutOrder(elements, appState, app),
});

const fitSelectedFrameToContent = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const frame = getSelectedFrame(appState, app);
  if (!frame) {
    return false;
  }

  const children = getNonDeletedElements(getFrameChildren(elements, frame.id));
  if (children.length === 0) {
    return false;
  }

  const padding = typeof frame.layoutPadding === "number" ? Math.max(0, frame.layoutPadding) : 16;
  const [minX, minY, maxX, maxY] = getCommonBounds(children);

  const targetWidth = Math.max(50, Math.round(maxX - minX + padding * 2));
  const targetHeight = Math.max(50, Math.round(maxY - minY + padding * 2));
  const targetX = Math.round(minX - padding);
  const targetY = Math.round(minY - padding);

  app.scene.mutateElement(frame, {
    x: targetX,
    y: targetY,
    width: targetWidth,
    height: targetHeight,
  });

  return {
    elements,
    appState,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

export const actionFitFrameToContent = register({
  name: "fitFrameToContent",
  label: "labels.fitFrameToContent",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
  perform: (elements, appState, _, app) =>
    fitSelectedFrameToContent(elements, appState, app),
});

