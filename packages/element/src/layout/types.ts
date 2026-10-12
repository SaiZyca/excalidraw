import type {
  FrameLayoutMode,
  FrameLayoutAlignHorizontal,
  FrameLayoutAlignVertical,
  FrameLayoutSortOrder,
  NonDeletedExcalidrawElement,
} from "../types";
import type { BoundingBox } from "../bounds";

export type {
  FrameLayoutMode,
  FrameLayoutAlignHorizontal,
  FrameLayoutAlignVertical,
  FrameLayoutSortOrder,
};

export type LayoutMode =
  | "distributeHorizontal"
  | "distributeVertical"
  | "masonry"
  | "packery";

export interface LayoutOptions {
  /**
   * Spacing between elements/groups in pixels.
   * Applies universally to all layout modes (distribute, masonry, packery).
   * Defaults to 16 if not provided.
   */
  gap?: number;

  /**
   * For Masonry: Number of columns.
   * If not specified or <= 0, automatically computed based on elements and container width.
   */
  columns?: number;

  /**
   * For Masonry / Packery / Row: Custom container width boundary.
   * If not specified, automatically derived from the bounding box or estimated ideal aspect ratio.
   */
  containerWidth?: number;

  /**
   * Custom container height boundary (used for Col column-flow if bounded).
   */
  containerHeight?: number;

  /**
   * Horizontal alignment (Left, Center, Right)
   */
  alignHorizontal?: FrameLayoutAlignHorizontal;

  /**
   * Vertical alignment (Top, Center, Bottom)
   */
  alignVertical?: FrameLayoutAlignVertical;

  /**
   * Deterministic sorting order for children
   */
  sortOrder?: FrameLayoutSortOrder;

  /**
   * For Masonry: Scale items to fit the column width proportionally
   */
  masonryFitWidth?: boolean;
}

export interface LayoutUnit {
  elements: readonly NonDeletedExcalidrawElement[];
  box: BoundingBox;
}

export interface UnitTargetPosition {
  unit: LayoutUnit;
  targetX: number;
  targetY: number;
  targetWidth?: number;
  targetHeight?: number;
}
