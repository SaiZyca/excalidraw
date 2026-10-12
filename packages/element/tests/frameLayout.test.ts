import { describe, it, expect } from "vitest";
import { layoutFrameChildren } from "../src/layout/frameLayout";
import type {
  ExcalidrawFrameElement,
  NonDeletedExcalidrawElement,
} from "../src/types";

describe("layoutFrameChildren", () => {
  const mockScene = {
    mutateElement: (el: any, updates: any) => {
      Object.assign(el, updates);
      return el;
    },
  } as any;

  const appState = {
    selectedGroupIds: {},
    editingGroupId: null,
  } as any;

  const makeFrame = (
    x = 100,
    y = 100,
    width = 300,
    height = 200,
    opts: Partial<ExcalidrawFrameElement> = {},
  ): ExcalidrawFrameElement =>
    ({
      id: "frame-1",
      type: "frame",
      x,
      y,
      width,
      height,
      layoutMode: "packery",
      layoutGap: 10,
      layoutPadding: 20,
      autoHeight: true,
      isDeleted: false,
      groupIds: [],
      version: 1,
      versionNonce: 1,
      ...opts,
    } as unknown as ExcalidrawFrameElement);

  const makeChild = (
    id: string,
    frameId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): NonDeletedExcalidrawElement =>
    ({
      id,
      frameId,
      x,
      y,
      width,
      height,
      isDeleted: false,
      groupIds: [],
      version: 1,
      versionNonce: 1,
    } as unknown as NonDeletedExcalidrawElement);

  it("should arrange children inside frame using packery and update frame height", () => {
    const frame = makeFrame(100, 100, 300, 100, {
      layoutMode: "packery",
      layoutSortOrder: "natural",
      layoutGap: 10,
      layoutPadding: 20,
      autoHeight: true,
    });

    const c1 = makeChild("c1", "frame-1", 0, 0, 120, 80);
    const c2 = makeChild("c2", "frame-1", 0, 0, 120, 60);
    const c3 = makeChild("c3", "frame-1", 0, 0, 250, 100);
    const children = [c1, c2, c3];

    const elementsMap = new Map<string, any>([
      ["frame-1", frame],
      ["c1", c1],
      ["c2", c2],
      ["c3", c3],
    ]);

    const result = layoutFrameChildren(
      frame,
      children,
      elementsMap as any,
      appState,
      mockScene,
    );

    expect(result.updatedChildren).toHaveLength(3);

    // Padding is 20, frame starts at (100, 100), content starts at (120, 120)
    expect(c1.x).toBe(120);
    expect(c1.y).toBe(120);

    // Container width is 300 - 40 = 260.
    // c1 width = 120 + 10 gap = 130. Remaining space = 130 >= c2 width (120 + 10 = 130).
    // So c2 fits on the same row next to c1!
    expect(c2.x).toBe(120 + 120 + 10); // 250
    expect(c2.y).toBe(120);

    // c3 is 250 wide (+10 gap = 260), it wraps to the next line below c1/c2 (y = 120 + 80 + 10 = 210)
    expect(c3.x).toBe(120);
    expect(c3.y).toBe(210);

    // Frame autoHeight: c3 ends at y = 210 + 100 = 310.
    // Frame starts at y=100. padding is 20.
    // Expected frame height = 310 - 100 + 20 = 230.
    expect(result.frame.height).toBe(230);
  });

  it("should arrange children using packery with areaDesc sorting", () => {
    const frame = makeFrame(100, 100, 300, 100, {
      layoutMode: "packery",
      layoutSortOrder: "areaDesc",
      layoutGap: 10,
      layoutPadding: 20,
      autoHeight: true,
    });

    const c1 = makeChild("c1", "frame-1", 0, 0, 120, 80); // area 9600
    const c2 = makeChild("c2", "frame-1", 0, 0, 120, 60); // area 7200
    const c3 = makeChild("c3", "frame-1", 0, 0, 250, 100); // area 25000 (largest)
    const children = [c1, c2, c3];

    const elementsMap = new Map<string, any>([
      ["frame-1", frame],
      ["c1", c1],
      ["c2", c2],
      ["c3", c3],
    ]);

    const result = layoutFrameChildren(
      frame,
      children,
      elementsMap as any,
      appState,
      mockScene,
    );

    // c3 has the largest area and should be placed first at (120, 120)
    expect(c3.x).toBe(120);
    expect(c3.y).toBe(120);
    // c1 is next, placed below c3 at y = 120 + 100 + 10 = 230
    expect(c1.x).toBe(120);
    expect(c1.y).toBe(230);
    // c2 is placed next to c1 on the same row at x = 120 + 120 + 10 = 250
    expect(c2.x).toBe(250);
    expect(c2.y).toBe(230);
  });

  it("should do nothing when layoutMode is none", () => {
    const frame = makeFrame(0, 0, 300, 200, { layoutMode: "none" });
    const c1 = makeChild("c1", "frame-1", 50, 50, 100, 50);

    const result = layoutFrameChildren(
      frame,
      [c1],
      new Map([["c1", c1]]) as any,
      appState,
      mockScene,
    );

    expect(result.updatedChildren).toHaveLength(0);
    expect(c1.x).toBe(50);
  });
});
