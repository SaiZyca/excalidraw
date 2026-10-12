import clsx from "clsx";
import { useRef, useState } from "react";
import { Popover } from "radix-ui";

import { CLASSES } from "@excalidraw/common";

import {
  isArrowElement,
  isFrameLikeElement,
  getFrameChildren,
  getNonDeletedElements,
  layoutFrameChildren,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  FrameLayoutMode,
  FrameLayoutAlignHorizontal,
  FrameLayoutAlignVertical,
  FrameLayoutSortOrder,
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";
import { RadioSelection } from "./RadioSelection";

import {
  actionToggleZenMode,
  actionConvertFrameToGroup,
  actionCropImagesSquare,
  actionResetImagesCrop,
  actionResetImageAspectRatio,
  actionResetImageOriginalResolution,
  actionUnifyElementsWidth,
  actionUnifyElementsHeight,
  actionFreezeFrameLayoutOrder,
  actionFitFrameToContent,
} from "../actions";

import { t } from "../i18n";
import { getTargetElements } from "../scene";

import { getFormValue } from "../actions/actionProperties";

import { useTextEditorFocus } from "../hooks/useTextEditorFocus";

import { actionToggleViewMode } from "../actions/actionToggleViewMode";

import "./Actions.scss";

import { useExcalidrawContainer } from "./App";
import Stack from "./Stack";
import { Tooltip } from "./Tooltip";
import { PropertiesPopover } from "./PropertiesPopover";
import {
  sharpArrowIcon,
  roundArrowIcon,
  elbowArrowIcon,
  TextSizeIcon,
  adjustmentsIcon,
  DotsHorizontalIcon,
  pencilIcon,
  FrameLayoutOffIcon,
  FrameLayoutRowIcon,
  FrameLayoutColIcon,
  FrameLayoutMasonryIcon,
  FrameLayoutPackeryIcon,
  AlignLeftIcon,
  CenterHorizontallyIcon,
  AlignRightIcon,
  AlignTopIcon,
  CenterVerticallyIcon,
  AlignBottomIcon,
  GroupIcon,
} from "./icons";

import { Island } from "./Island";

import { getShapeActionPredicates } from "./shapeActionPredicates";

import type { ShapeActionPredicates } from "./shapeActionPredicates";
import type { AppClassProperties, UIAppState, AppState } from "../types";
import type { ActionManager } from "../actions/manager";

// re-exported for consumers outside the styles panel (e.g. CommandPalette)
export {
  canChangeStrokeColor,
  canChangeBackgroundColor,
} from "./shapeActionPredicates";

// Common CSS class combinations
const PROPERTIES_CLASSES = clsx([
  CLASSES.SHAPE_ACTIONS_THEME_SCOPE,
  "properties-content",
]);

/**
 * The "arrange" (z-order) fieldset, identical across every styles-panel layout.
 */
const LayersFieldset = ({
  renderAction,
}: {
  renderAction: ActionManager["renderAction"];
}) => (
  <fieldset>
    <legend>{t("labels.layers")}</legend>
    <div className="buttonList">
      {renderAction("sendToBack")}
      {renderAction("sendBackward")}
      {renderAction("bringForward")}
      {renderAction("bringToFront")}
    </div>
  </fieldset>
);

/**
 * The align + distribute fieldset, identical across every styles-panel layout.
 * Button order is mirrored for RTL so the leftmost button always aligns left.
 */
const AlignFieldset = ({
  renderAction,
  showDistribute,
}: {
  renderAction: ActionManager["renderAction"];
  showDistribute: boolean;
}) => {
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  return (
    <fieldset>
      <legend>{t("labels.align")}</legend>
      <div className="buttonList align-buttons">
        <div className="align-buttons__row">
          {isRTL ? (
            <>
              {renderAction("alignRight")}
              {renderAction("alignHorizontallyCentered")}
              {renderAction("alignLeft")}
            </>
          ) : (
            <>
              {renderAction("alignLeft")}
              {renderAction("alignHorizontallyCentered")}
              {renderAction("alignRight")}
            </>
          )}
          {showDistribute && renderAction("distributeHorizontally")}
        </div>
        <div className="align-buttons__row">
          {renderAction("alignTop")}
          {renderAction("alignVerticallyCentered")}
          {renderAction("alignBottom")}
          {showDistribute && renderAction("distributeVertically")}
        </div>
      </div>
    </fieldset>
  );
};

const FrameLayoutFieldset = ({
  appState,
  app,
}: {
  appState: UIAppState;
  app: AppClassProperties;
}) => {
  const [, setTick] = useState(0);
  const selectedElements = app.scene.getSelectedElements(appState);
  if (
    selectedElements.length !== 1 ||
    !isFrameLikeElement(selectedElements[0])
  ) {
    return null;
  }
  const frame = selectedElements[0] as ExcalidrawFrameElement;
  const currentMode: FrameLayoutMode = frame.layoutMode ?? "none";
  const currentGap = frame.layoutGap ?? 16;
  const currentPadding = frame.layoutPadding ?? 16;
  const currentAlignH: FrameLayoutAlignHorizontal =
    frame.layoutAlignHorizontal ?? "start";
  const currentAlignV: FrameLayoutAlignVertical =
    frame.layoutAlignVertical ?? "start";
  const currentSortOrder: FrameLayoutSortOrder =
    frame.layoutSortOrder ??
    (currentMode === "packery" ? "areaDesc" : "natural");

  const applyLayout = (
    overrides: Partial<{
      layoutMode: FrameLayoutMode;
      gap: number;
      padding: number;
      alignHorizontal: FrameLayoutAlignHorizontal;
      alignVertical: FrameLayoutAlignVertical;
      sortOrder: FrameLayoutSortOrder;
    }>,
  ) => {
    const nextMode = overrides.layoutMode ?? frame.layoutMode ?? "none";
    const nextGap = overrides.gap ?? frame.layoutGap ?? 16;
    const nextPadding = overrides.padding ?? frame.layoutPadding ?? 16;
    const nextAlignH =
      overrides.alignHorizontal ?? frame.layoutAlignHorizontal ?? "start";
    const nextAlignV =
      overrides.alignVertical ?? frame.layoutAlignVertical ?? "start";
    const nextSortOrder =
      overrides.sortOrder ??
      frame.layoutSortOrder ??
      (nextMode === "packery" ? "areaDesc" : "natural");

    app.scene.mutateElement(frame, {
      layoutMode: nextMode,
      layoutGap: nextGap,
      layoutPadding: nextPadding,
      layoutAlignHorizontal: nextAlignH,
      layoutAlignVertical: nextAlignV,
      layoutSortOrder: nextSortOrder,
    });

    if (nextMode !== "none") {
      const children = getNonDeletedElements(
        getFrameChildren(
          app.scene.getElementsIncludingDeleted(),
          frame.id,
        ),
      );
      layoutFrameChildren(
        frame,
        children,
        app.scene.getNonDeletedElementsMap(),
        app.state,
        app.scene,
        {
          layoutMode: nextMode,
          gap: nextGap,
          alignHorizontal: nextAlignH,
          alignVertical: nextAlignV,
          sortOrder: nextSortOrder,
        },
      );
    }

    app.scene.triggerUpdate();
    setTick((t) => t + 1);
  };

  return (
    <fieldset className="frame-layout-fieldset">
      <legend>{t("labels.frameLayout")}</legend>
      <div className="buttonList">
        <RadioSelection
          group="frame-layout-mode"
          options={[
            {
              value: "none" as const,
              text: t("labels.frameLayoutNone"),
              icon: FrameLayoutOffIcon,
              testId: "frame-layout-none",
            },
            {
              value: "distributeHorizontal" as const,
              text: t("labels.frameLayoutHorizontal"),
              icon: FrameLayoutRowIcon,
              testId: "frame-layout-row",
            },
            {
              value: "distributeVertical" as const,
              text: t("labels.frameLayoutVertical"),
              icon: FrameLayoutColIcon,
              testId: "frame-layout-col",
            },
            {
              value: "masonry" as const,
              text: t("labels.frameLayoutMasonry"),
              icon: FrameLayoutMasonryIcon,
              testId: "frame-layout-masonry",
            },
            {
              value: "packery" as const,
              text: t("labels.frameLayoutPackery"),
              icon: FrameLayoutPackeryIcon,
              testId: "frame-layout-packery",
            },
          ]}
          value={currentMode}
          onChange={(mode) => applyLayout({ layoutMode: mode })}
        />
      </div>

      {currentMode !== "none" && (
        <>
          <div className="frame-layout-alignments">
            <div className="frame-layout-align-row">
              <span className="frame-layout-label">
                {t("labels.frameLayoutAlignHorizontal")}
              </span>
              <RadioSelection
                group="frame-layout-align-h"
                options={[
                  {
                    value: "start" as const,
                    text: t("labels.alignLeft"),
                    icon: AlignLeftIcon,
                    testId: "frame-layout-align-left",
                  },
                  {
                    value: "center" as const,
                    text: t("labels.centerHorizontally"),
                    icon: CenterHorizontallyIcon,
                    testId: "frame-layout-align-center-h",
                  },
                  {
                    value: "end" as const,
                    text: t("labels.alignRight"),
                    icon: AlignRightIcon,
                    testId: "frame-layout-align-right",
                  },
                ]}
                value={currentAlignH}
                onChange={(alignH) => applyLayout({ alignHorizontal: alignH })}
              />
            </div>
            <div className="frame-layout-align-row">
              <span className="frame-layout-label">
                {t("labels.frameLayoutAlignVertical")}
              </span>
              <RadioSelection
                group="frame-layout-align-v"
                options={[
                  {
                    value: "start" as const,
                    text: t("labels.alignTop"),
                    icon: AlignTopIcon,
                    testId: "frame-layout-align-top",
                  },
                  {
                    value: "center" as const,
                    text: t("labels.centerVertically"),
                    icon: CenterVerticallyIcon,
                    testId: "frame-layout-align-center-v",
                  },
                  {
                    value: "end" as const,
                    text: t("labels.alignBottom"),
                    icon: AlignBottomIcon,
                    testId: "frame-layout-align-bottom",
                  },
                ]}
                value={currentAlignV}
                onChange={(alignV) => applyLayout({ alignVertical: alignV })}
              />
            </div>
            <div className="frame-layout-align-row">
              <span className="frame-layout-label">
                {t("labels.frameLayoutSortOrder")}
              </span>
              <select
                className="frame-layout-sort-select"
                value={currentSortOrder}
                onChange={(e) =>
                  applyLayout({
                    sortOrder: e.target.value as FrameLayoutSortOrder,
                  })
                }
              >
                <option value="natural">
                  {t("labels.frameLayoutSortNatural")}
                </option>
                <option value="areaDesc">
                  {t("labels.frameLayoutSortAreaDesc")}
                </option>
                <option value="areaAsc">
                  {t("labels.frameLayoutSortAreaAsc")}
                </option>
                <option value="widthDesc">
                  {t("labels.frameLayoutSortWidthDesc")}
                </option>
                <option value="heightDesc">
                  {t("labels.frameLayoutSortHeightDesc")}
                </option>
                <option value="nameAsc">
                  {t("labels.frameLayoutSortNameAsc")}
                </option>
              </select>
            </div>
          </div>

          <div className="frame-layout-inputs">
            <label>
              <span>{t("labels.frameLayoutGap")}:</span>
              <input
                type="number"
                min={0}
                max={100}
                value={currentGap}
                onChange={(e) =>
                  applyLayout({
                    gap: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              <span>{t("labels.frameLayoutPadding")}:</span>
              <input
                type="number"
                min={0}
                max={100}
                value={currentPadding}
                onChange={(e) =>
                  applyLayout({
                    padding: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
            </label>
          </div>

          <div className="frame-layout-tools-row">
            <button
              type="button"
              className="frame-tool-btn"
              title={t("labels.cropImagesSquare")}
              onClick={() => {
                const res = actionCropImagesSquare.perform(
                  app.scene.getElementsIncludingDeleted(),
                  appState as AppState,
                  null,
                  app,
                );
                if (res) {
                  app.syncActionResult(res);
                  setTick((t) => t + 1);
                }
              }}
            >
              1:1
            </button>
            <button
              type="button"
              className="frame-tool-btn"
              title={t("labels.unifyElementsWidth")}
              onClick={() => {
                const res = actionUnifyElementsWidth.perform(
                  app.scene.getElementsIncludingDeleted(),
                  appState as AppState,
                  null,
                  app,
                );
                if (res) {
                  app.syncActionResult(res);
                  setTick((t) => t + 1);
                }
              }}
            >
              ↔
            </button>
            <button
              type="button"
              className="frame-tool-btn"
              title={t("labels.unifyElementsHeight")}
              onClick={() => {
                const res = actionUnifyElementsHeight.perform(
                  app.scene.getElementsIncludingDeleted(),
                  appState as AppState,
                  null,
                  app,
                );
                if (res) {
                  app.syncActionResult(res);
                  setTick((t) => t + 1);
                }
              }}
            >
              ↕
            </button>
            <button
              type="button"
              className="frame-tool-btn"
              title={t("labels.resetImagesCrop")}
              onClick={() => {
                const res = actionResetImagesCrop.perform(
                  app.scene.getElementsIncludingDeleted(),
                  appState as AppState,
                  null,
                  app,
                );
                if (res) {
                  app.syncActionResult(res);
                  setTick((t) => t + 1);
                }
              }}
            >
              ↺
            </button>
            <button
              type="button"
              className="frame-tool-btn"
              title={t("labels.resetImageAspectRatio")}
              onClick={() => {
                const res = actionResetImageAspectRatio.perform(
                  app.scene.getElementsIncludingDeleted(),
                  appState as AppState,
                  null,
                  app,
                );
                if (res) {
                  app.syncActionResult(res);
                  setTick((t) => t + 1);
                }
              }}
            >
              ⚖
            </button>
            <button
              type="button"
              className="frame-tool-btn"
              title={t("labels.resetImageOriginalResolution")}
              onClick={() => {
                const res = actionResetImageOriginalResolution.perform(
                  app.scene.getElementsIncludingDeleted(),
                  appState as AppState,
                  null,
                  app,
                );
                if (res) {
                  app.syncActionResult(res);
                  setTick((t) => t + 1);
                }
              }}
            >
              100%
            </button>
            <button
              type="button"
              className="frame-tool-btn"
              title={t("labels.freezeFrameLayoutOrder")}
              onClick={() => {
                const res = actionFreezeFrameLayoutOrder.perform(
                  app.scene.getElementsIncludingDeleted(),
                  appState as AppState,
                  null,
                  app,
                );
                if (res) {
                  app.syncActionResult(res);
                  setTick((t) => t + 1);
                }
              }}
            >
              📌
            </button>
          </div>
        </>
      )}

      <div className="frame-layout-actions">
        <button
          type="button"
          className="frame-convert-button"
          title={t("labels.fitFrameToContent")}
          onClick={() => {
            const res = actionFitFrameToContent.perform(
              app.scene.getElementsIncludingDeleted(),
              appState as AppState,
              null,
              app,
            );
            if (res) {
              app.syncActionResult(res);
            }
          }}
        >
          <span>📐 {t("labels.fitFrameToContent")}</span>
        </button>
        <button
          type="button"
          className="frame-convert-button"
          title={t("labels.convertFrameToGroup")}
          onClick={() => {
            const res = actionConvertFrameToGroup.perform(
              app.scene.getElementsIncludingDeleted(),
              appState as AppState,
              null,
              app,
            );
            if (res) {
              app.syncActionResult(res);
            }
          }}
        >
          <GroupIcon theme={appState.theme} />
          <span>{t("labels.convertFrameToGroup")}</span>
        </button>
      </div>
    </fieldset>
  );
};

/**
 * Full styles panel: the wide, always-expanded layout used on desktop when the
 * UI is in "full" mode.
 */
export const SelectedShapeActions = ({
  appState,
  elementsMap,
  renderAction,
  app,
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
  renderAction: ActionManager["renderAction"];
  app: AppClassProperties;
}) => {
  const targetElements = getTargetElements(elementsMap, appState);
  const predicates = getShapeActionPredicates(
    appState,
    targetElements,
    elementsMap,
    app,
  );

  // the bucket fill tool configures only the fill it creates: color, fill
  // style, and opacity (shared `currentItem*` values; no stroke properties)
  if (appState.activeTool.type === "bucketfill") {
    return (
      <div className="selected-shape-actions">
        <div>{renderAction("changeBucketFillBackgroundColor")}</div>
        {renderAction("changeFillStyle")}
        {renderAction("changeOpacity")}
      </div>
    );
  }

  return (
    <div className="selected-shape-actions">
      <div>{predicates.strokeColor && renderAction("changeStrokeColor")}</div>
      {predicates.backgroundColor && (
        <div>{renderAction("changeBackgroundColor")}</div>
      )}
      {predicates.fill && renderAction("changeFillStyle")}

      {predicates.strokeWidth && renderAction("changeStrokeWidth")}

      {predicates.strokeStyle && <>{renderAction("changeStrokeStyle")}</>}

      {predicates.freedrawMode && renderAction("changeFreedrawMode")}

      {predicates.sloppiness && <>{renderAction("changeSloppiness")}</>}

      {predicates.roundness && <>{renderAction("changeRoundness")}</>}

      {predicates.arrowType && <>{renderAction("changeArrowType")}</>}

      {predicates.text && (
        <>
          <fieldset>{renderAction("changeFontFamily")}</fieldset>
          {renderAction("changeFontSize")}
          {predicates.textAlign && renderAction("changeTextAlign")}
        </>
      )}

      {predicates.verticalAlign && renderAction("changeVerticalAlign")}
      {predicates.arrowheads && <>{renderAction("changeArrowhead")}</>}

      {predicates.opacity && renderAction("changeOpacity")}

      {predicates.layers && <LayersFieldset renderAction={renderAction} />}

      {predicates.align && (
        <AlignFieldset
          renderAction={renderAction}
          showDistribute={predicates.distribute}
        />
      )}
      {predicates.frameLayout && (
        <FrameLayoutFieldset appState={appState} app={app} />
      )}
      {predicates.showExtraActions && (
        <fieldset>
          <legend>{t("labels.actions")}</legend>
          <div className="buttonList">
            {renderAction("duplicateSelection")}
            {renderAction("deleteSelectedElements")}
            {renderAction("group")}
            {renderAction("ungroup")}
            {predicates.link && renderAction("hyperlink")}
            {predicates.cropEditor && renderAction("cropEditor")}
            {predicates.imageProperties && (
              <>
                <button
                  type="button"
                  className="frame-tool-btn"
                  title={t("labels.resetImagesCrop")}
                  style={{ width: "2rem", height: "2rem", padding: 0 }}
                  onClick={() => {
                    const res = actionResetImagesCrop.perform(
                      app.scene.getElementsIncludingDeleted(),
                      appState as AppState,
                      null,
                      app,
                    );
                    if (res) {
                      app.syncActionResult(res);
                    }
                  }}
                >
                  ↺
                </button>
                <button
                  type="button"
                  className="frame-tool-btn"
                  title={t("labels.resetImageAspectRatio")}
                  style={{ width: "2rem", height: "2rem", padding: 0 }}
                  onClick={() => {
                    const res = actionResetImageAspectRatio.perform(
                      app.scene.getElementsIncludingDeleted(),
                      appState as AppState,
                      null,
                      app,
                    );
                    if (res) {
                      app.syncActionResult(res);
                    }
                  }}
                >
                  ⚖
                </button>
                <button
                  type="button"
                  className="frame-tool-btn"
                  title={t("labels.resetImageOriginalResolution")}
                  style={{ width: "2rem", height: "2rem", padding: 0 }}
                  onClick={() => {
                    const res = actionResetImageOriginalResolution.perform(
                      app.scene.getElementsIncludingDeleted(),
                      appState as AppState,
                      null,
                      app,
                    );
                    if (res) {
                      app.syncActionResult(res);
                    }
                  }}
                >
                  100%
                </button>
              </>
            )}
            {predicates.lineEditor && renderAction("toggleLinearEditor")}
          </div>
        </fieldset>
      )}
    </div>
  );
};

const CombinedShapeProperties = ({
  appState,
  renderAction,
  setAppState,
  predicates,
  container,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  predicates: ShapeActionPredicates;
  container: HTMLDivElement | null;
}) => {
  const shouldShowCombinedProperties =
    predicates.hasSelection ||
    (appState.activeTool.type !== "selection" &&
      appState.activeTool.type !== "eraser" &&
      appState.activeTool.type !== "hand" &&
      appState.activeTool.type !== "laser" &&
      appState.activeTool.type !== "lasso");
  const isOpen = appState.openPopup === "compactStrokeStyles";

  if (!shouldShowCombinedProperties) {
    return null;
  }

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setAppState({ openPopup: "compactStrokeStyles" });
          } else {
            setAppState({ openPopup: null });
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.stroke")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              setAppState({
                openPopup: isOpen ? null : "compactStrokeStyles",
              });
            }}
          >
            {adjustmentsIcon}
          </button>
        </Popover.Trigger>
        {isOpen && (
          <PropertiesPopover
            className={PROPERTIES_CLASSES}
            container={container}
            style={{ maxWidth: "13rem" }}
            onClose={() => {}}
          >
            <div className="selected-shape-actions">
              {predicates.fill && renderAction("changeFillStyle")}
              {predicates.strokeWidth && renderAction("changeStrokeWidth")}
              {
                /* in compact UI the freedraw pressure setting is rendered as a
                  standalone cycle button in the compact actions list; we render
                  it in the combined properties popup as well for clarity
                */
                predicates.freedrawMode && renderAction("changeFreedrawMode")
              }
              {predicates.strokeStyle && (
                <>{renderAction("changeStrokeStyle")}</>
              )}
              {predicates.sloppiness && <>{renderAction("changeSloppiness")}</>}
              {predicates.roundness && renderAction("changeRoundness")}
              {predicates.opacity && renderAction("changeOpacity")}
            </div>
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const CombinedArrowProperties = ({
  appState,
  renderAction,
  setAppState,
  targetElements,
  predicates,
  container,
  app,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  targetElements: ExcalidrawElement[];
  predicates: ShapeActionPredicates;
  container: HTMLDivElement | null;
  app: AppClassProperties;
}) => {
  if (!predicates.arrowType) {
    return null;
  }

  const isOpen = appState.openPopup === "compactArrowProperties";

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setAppState({ openPopup: "compactArrowProperties" });
          } else {
            setAppState({ openPopup: null });
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.arrowtypes")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              setAppState({
                openPopup: isOpen ? null : "compactArrowProperties",
              });
            }}
          >
            {(() => {
              // Show an icon based on the current arrow type
              const arrowType = getFormValue(
                targetElements,
                app,
                (element) => {
                  if (isArrowElement(element)) {
                    return element.elbowed
                      ? "elbow"
                      : element.roundness
                      ? "round"
                      : "sharp";
                  }
                  return null;
                },
                (element) => isArrowElement(element),
                (hasSelection) =>
                  hasSelection ? null : appState.currentItemArrowType,
              );

              if (arrowType === "elbow") {
                return elbowArrowIcon;
              }
              if (arrowType === "round") {
                return roundArrowIcon;
              }
              return sharpArrowIcon;
            })()}
          </button>
        </Popover.Trigger>
        {isOpen && (
          <PropertiesPopover
            container={container}
            className="properties-content"
            style={{ maxWidth: "13rem" }}
            onClose={() => {}}
          >
            {renderAction("changeArrowProperties")}
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const CombinedTextProperties = ({
  appState,
  renderAction,
  setAppState,
  predicates,
  container,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  predicates: ShapeActionPredicates;
  container: HTMLDivElement | null;
}) => {
  const { saveCaretPosition, restoreCaretPosition } = useTextEditorFocus(
    container?.ownerDocument,
  );
  const isOpen = appState.openPopup === "compactTextProperties";

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            if (appState.editingTextElement) {
              saveCaretPosition();
            }
            setAppState({ openPopup: "compactTextProperties" });
          } else {
            setAppState({ openPopup: null });
            if (appState.editingTextElement) {
              restoreCaretPosition();
            }
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.textAlign")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              if (isOpen) {
                setAppState({ openPopup: null });
              } else {
                if (appState.editingTextElement) {
                  saveCaretPosition();
                }
                setAppState({ openPopup: "compactTextProperties" });
              }
            }}
          >
            {TextSizeIcon}
          </button>
        </Popover.Trigger>
        {appState.openPopup === "compactTextProperties" && (
          <PropertiesPopover
            className={PROPERTIES_CLASSES}
            container={container}
            style={{ maxWidth: "13rem" }}
            // Improve focus handling for text editing scenarios
            preventAutoFocusOnTouch={!!appState.editingTextElement}
            onClose={() => {
              // Refocus text editor when popover closes with caret restoration
              if (appState.editingTextElement) {
                restoreCaretPosition();
              }
            }}
          >
            <div className="selected-shape-actions">
              {predicates.text && renderAction("changeFontSize")}
              {predicates.textAlign && renderAction("changeTextAlign")}
              {predicates.verticalAlign && renderAction("changeVerticalAlign")}
            </div>
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const CombinedExtraActions = ({
  appState,
  renderAction,
  predicates,
  setAppState,
  container,
  showDuplicate,
  showDelete,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  predicates: ShapeActionPredicates;
  setAppState: React.Component<any, AppState>["setState"];
  container: HTMLDivElement | null;
  showDuplicate?: boolean;
  showDelete?: boolean;
}) => {
  const isOpen = appState.openPopup === "compactOtherProperties";

  if (!predicates.showExtraActions) {
    return null;
  }

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setAppState({ openPopup: "compactOtherProperties" });
          } else {
            setAppState({ openPopup: null });
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.actions")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAppState({
                openPopup: isOpen ? null : "compactOtherProperties",
              });
            }}
          >
            {DotsHorizontalIcon}
          </button>
        </Popover.Trigger>
        {isOpen && (
          <PropertiesPopover
            className={PROPERTIES_CLASSES}
            container={container}
            style={{
              maxWidth: "12rem",
              justifyContent: "center",
              alignItems: "center",
            }}
            onClose={() => {}}
          >
            <div className="selected-shape-actions">
              {predicates.layers && (
                <LayersFieldset renderAction={renderAction} />
              )}

              {predicates.align && (
                <AlignFieldset
                  renderAction={renderAction}
                  showDistribute={predicates.distribute}
                />
              )}
              <fieldset>
                <legend>{t("labels.actions")}</legend>
                <div className="buttonList">
                  {renderAction("group")}
                  {renderAction("ungroup")}
                  {predicates.linkSingleOnly && renderAction("hyperlink")}
                  {predicates.cropEditor && renderAction("cropEditor")}
                  {showDuplicate && renderAction("duplicateSelection")}
                  {showDelete && renderAction("deleteSelectedElements")}
                </div>
              </fieldset>
            </div>
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const LinearEditorAction = ({
  renderAction,
  predicates,
}: {
  renderAction: ActionManager["renderAction"];
  predicates: ShapeActionPredicates;
}) => {
  if (!predicates.lineEditor) {
    return null;
  }

  return (
    <div className="compact-action-item">
      {renderAction("toggleLinearEditor")}
    </div>
  );
};

/**
 * Compact styles panel — the collapsed, popover-driven layout used on tablets
 * and on desktop when the UI is in "compact" mode.
 */
export const CompactShapeActions = ({
  appState,
  elementsMap,
  renderAction,
  app,
  setAppState,
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
  renderAction: ActionManager["renderAction"];
  app: AppClassProperties;
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const targetElements = getTargetElements(elementsMap, appState);
  const predicates = getShapeActionPredicates(
    appState,
    targetElements,
    elementsMap,
    app,
  );
  const { container } = useExcalidrawContainer();

  return (
    <div className="compact-shape-actions">
      {/* Stroke Color */}
      {predicates.strokeColor && (
        <div className={clsx("compact-action-item")}>
          {renderAction("changeStrokeColor")}
        </div>
      )}

      {/* Background Color (the bucket fill variant excludes `transparent`) */}
      {predicates.backgroundColor && (
        <div className="compact-action-item">
          {renderAction(
            appState.activeTool.type === "bucketfill"
              ? "changeBucketFillBackgroundColor"
              : "changeBackgroundColor",
          )}
        </div>
      )}

      {/* Freedraw pressure: standalone button cycling the variability mode */}
      {predicates.freedrawMode && (
        <div className="compact-action-item">
          {renderAction("changeFreedrawMode", { cycle: true })}
        </div>
      )}

      <CombinedShapeProperties
        appState={appState}
        renderAction={renderAction}
        setAppState={setAppState}
        predicates={predicates}
        container={container}
      />

      <CombinedArrowProperties
        appState={appState}
        renderAction={renderAction}
        setAppState={setAppState}
        targetElements={targetElements}
        predicates={predicates}
        container={container}
        app={app}
      />
      {/* Linear Editor */}
      {predicates.lineEditor && (
        <div className="compact-action-item">
          {renderAction("toggleLinearEditor")}
        </div>
      )}

      {/* Text Properties */}
      {predicates.text && (
        <>
          <div className="compact-action-item">
            {renderAction("changeFontFamily")}
          </div>
          <CombinedTextProperties
            appState={appState}
            renderAction={renderAction}
            setAppState={setAppState}
            predicates={predicates}
            container={container}
          />
        </>
      )}

      {/* Dedicated Copy Button */}
      {predicates.showExtraActions && (
        <div className="compact-action-item">
          {renderAction("duplicateSelection")}
        </div>
      )}

      {/* Dedicated Delete Button */}
      {predicates.showExtraActions && (
        <div className="compact-action-item">
          {renderAction("deleteSelectedElements")}
        </div>
      )}

      <CombinedExtraActions
        appState={appState}
        renderAction={renderAction}
        predicates={predicates}
        setAppState={setAppState}
        container={container}
      />
    </div>
  );
};

/**
 * Mobile styles panel — the horizontal action bar used on phones, with an
 * overflow measurement that promotes duplicate/delete out of the popover when
 * there is room.
 */
export const MobileShapeActions = ({
  appState,
  elementsMap,
  renderAction,
  app,
  setAppState,
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
  renderAction: ActionManager["renderAction"];
  app: AppClassProperties;
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const targetElements = getTargetElements(elementsMap, appState);
  const predicates = getShapeActionPredicates(
    appState,
    targetElements,
    elementsMap,
    app,
  );
  const { container } = useExcalidrawContainer();
  const mobileActionsRef = useRef<HTMLDivElement>(null);

  const ACTIONS_WIDTH =
    mobileActionsRef.current?.getBoundingClientRect()?.width ?? 0;

  // 7 actions + 2 for undo/redo
  const MIN_ACTIONS = 9;

  const GAP = 6;
  const WIDTH = 32;

  const MIN_WIDTH = MIN_ACTIONS * WIDTH + (MIN_ACTIONS - 1) * GAP;

  const ADDITIONAL_WIDTH = WIDTH + GAP;

  const showDeleteOutside = ACTIONS_WIDTH >= MIN_WIDTH + ADDITIONAL_WIDTH;
  const showDuplicateOutside =
    ACTIONS_WIDTH >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH;

  return (
    <Island
      className="compact-shape-actions mobile-shape-actions"
      style={{
        flexDirection: "row",
        boxShadow: "none",
        padding: 0,
        zIndex: 2,
        backgroundColor: "transparent",
        height: WIDTH * 1.35,
        marginBottom: 4,
        alignItems: "center",
        gap: GAP,
        pointerEvents: "none",
      }}
      ref={mobileActionsRef}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: GAP,
          flex: 1,
        }}
      >
        {predicates.strokeColor && (
          <div className={clsx("compact-action-item")}>
            {renderAction("changeStrokeColor")}
          </div>
        )}
        {/* Background Color (the bucket fill variant excludes `transparent`) */}
        {predicates.backgroundColor && (
          <div className="compact-action-item">
            {renderAction(
              appState.activeTool.type === "bucketfill"
                ? "changeBucketFillBackgroundColor"
                : "changeBackgroundColor",
            )}
          </div>
        )}
        <CombinedShapeProperties
          appState={appState}
          renderAction={renderAction}
          setAppState={setAppState}
          predicates={predicates}
          container={container}
        />
        {/* Combined Arrow Properties */}
        <CombinedArrowProperties
          appState={appState}
          renderAction={renderAction}
          setAppState={setAppState}
          targetElements={targetElements}
          predicates={predicates}
          container={container}
          app={app}
        />
        {/* Linear Editor */}
        <LinearEditorAction
          renderAction={renderAction}
          predicates={predicates}
        />
        {/* Text Properties */}
        {predicates.text && (
          <>
            <div className="compact-action-item">
              {renderAction("changeFontFamily")}
            </div>
            <CombinedTextProperties
              appState={appState}
              renderAction={renderAction}
              setAppState={setAppState}
              predicates={predicates}
              container={container}
            />
          </>
        )}

        {/* Combined Other Actions */}
        <CombinedExtraActions
          appState={appState}
          renderAction={renderAction}
          predicates={predicates}
          setAppState={setAppState}
          container={container}
          showDuplicate={!showDuplicateOutside}
          showDelete={!showDeleteOutside}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: GAP,
        }}
      >
        <div className="compact-action-item">{renderAction("undo")}</div>
        <div className="compact-action-item">{renderAction("redo")}</div>
        {showDuplicateOutside && (
          <div className="compact-action-item">
            {renderAction("duplicateSelection")}
          </div>
        )}
        {showDeleteOutside && (
          <div className="compact-action-item">
            {renderAction("deleteSelectedElements")}
          </div>
        )}
      </div>
    </Island>
  );
};

export const ZoomActions = ({
  renderAction,
}: {
  renderAction: ActionManager["renderAction"];
}) => (
  <Stack.Col gap={1} className={CLASSES.ZOOM_ACTIONS}>
    <Stack.Row align="center">
      {renderAction("zoomOut")}
      {renderAction("resetZoom")}
      {renderAction("zoomIn")}
    </Stack.Row>
  </Stack.Col>
);

export const UndoRedoActions = ({
  renderAction,
  className,
}: {
  renderAction: ActionManager["renderAction"];
  className?: string;
}) => (
  <div className={`undo-redo-buttons ${className}`}>
    <div className="undo-button-container">
      <Tooltip label={t("buttons.undo")} delay>
        {renderAction("undo")}
      </Tooltip>
    </div>
    <div className="redo-button-container">
      <Tooltip label={t("buttons.redo")} delay>
        {renderAction("redo")}
      </Tooltip>
    </div>
  </div>
);

export const ExitZenModeButton = ({
  actionManager,
  showExitZenModeBtn,
}: {
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
}) => (
  <button
    type="button"
    className={clsx("disable-zen-mode", {
      "disable-zen-mode--visible": showExitZenModeBtn,
    })}
    onClick={() => actionManager.executeAction(actionToggleZenMode)}
  >
    {t("buttons.exitZenMode")}
  </button>
);

export const ExitViewModeButton = ({
  actionManager,
}: {
  actionManager: ActionManager;
}) => (
  <button
    type="button"
    className="disable-view-mode"
    onClick={() => actionManager.executeAction(actionToggleViewMode)}
  >
    {pencilIcon}
  </button>
);
