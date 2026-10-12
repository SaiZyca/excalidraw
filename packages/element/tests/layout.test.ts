import { describe, it, expect } from "vitest";
import {
  calculateDistributeWithGap,
  calculateMasonry,
  calculatePackery,
  layoutElements,
} from "../src/layout";
import type { LayoutUnit } from "../src/layout";
import type { NonDeletedExcalidrawElement } from "../src/types";

const makeMockUnit = (
  id: string,
  minX: number,
  minY: number,
  width: number,
  height: number,
): LayoutUnit => {
  const element = {
    id,
    x: minX,
    y: minY,
    width,
    height,
    isDeleted: false,
    groupIds: [],
    version: 1,
    versionNonce: 1,
  } as unknown as NonDeletedExcalidrawElement;

  return {
    elements: [element],
    box: {
      minX,
      minY,
      maxX: minX + width,
      maxY: minY + height,
      width,
      height,
      midX: minX + width / 2,
      midY: minY + height / 2,
    },
  };
};

describe("Layout Core Algorithms", () => {
  describe("calculateDistributeWithGap", () => {
    it("should distribute horizontally with configurable gap", () => {
      const u1 = makeMockUnit("1", 0, 10, 100, 50);
      const u2 = makeMockUnit("2", 300, 10, 100, 50);
      const u3 = makeMockUnit("3", 150, 10, 100, 50);
      const units = [u1, u2, u3];

      const bounds = {
        minX: 0,
        minY: 10,
        maxX: 400,
        maxY: 60,
        width: 400,
        height: 50,
        midX: 200,
        midY: 35,
      };

      const gap = 20;
      const res = calculateDistributeWithGap(units, bounds, "x", gap);

      expect(res).toHaveLength(3);
      // Sorted order by X: u1 (0), u3 (150), u2 (300)
      expect(res[0].unit.elements[0].id).toBe("1");
      expect(res[0].targetX).toBe(0);

      expect(res[1].unit.elements[0].id).toBe("3");
      expect(res[1].targetX).toBe(100 + gap); // 120

      expect(res[2].unit.elements[0].id).toBe("2");
      expect(res[2].targetX).toBe(120 + 100 + gap); // 240
    });

    it("should distribute vertically with configurable gap", () => {
      const u1 = makeMockUnit("1", 10, 0, 50, 100);
      const u2 = makeMockUnit("2", 10, 500, 50, 100);
      const units = [u1, u2];

      const bounds = {
        minX: 10,
        minY: 0,
        maxX: 60,
        maxY: 600,
        width: 50,
        height: 600,
        midX: 35,
        midY: 300,
      };

      const gap = 30;
      const res = calculateDistributeWithGap(units, bounds, "y", gap);

      expect(res[0].targetY).toBe(0);
      expect(res[1].targetY).toBe(100 + gap); // 130
    });
  });

  describe("calculateMasonry", () => {
    it("should place elements into the shortest column", () => {
      // 4 elements of different heights:
      // u1: h=100, u2: h=200, u3: h=80, u4: h=150
      const u1 = makeMockUnit("1", 0, 0, 100, 100);
      const u2 = makeMockUnit("2", 120, 0, 100, 200);
      const u3 = makeMockUnit("3", 0, 120, 100, 80);
      const u4 = makeMockUnit("4", 120, 220, 100, 150);
      const units = [u1, u2, u3, u4];

      const gap = 10;
      const bounds = {
        minX: 0,
        minY: 0,
        maxX: 210,
        maxY: 370,
        width: 210, // Exactly enough for 2 columns: colWidth=100, gap=10
        height: 370,
        midX: 105,
        midY: 185,
      };

      const res = calculateMasonry(units, bounds, { gap, columns: 2 });

      expect(res).toHaveLength(4);
      // Col 0: u1 (y=0..100) -> next slot y=110
      // Col 1: u2 (y=0..200) -> next slot y=210
      // u3 should go to Col 0 because 110 < 210
      // Col 0 then has 110 + 80 + 10 = 200
      // u4 should go to Col 0 because 200 < 210
      const posMap = new Map(res.map((r) => [r.unit.elements[0].id, r]));

      const posU1 = posMap.get("1")!;
      const posU2 = posMap.get("2")!;
      const posU3 = posMap.get("3")!;
      const posU4 = posMap.get("4")!;

      expect(posU1.targetX).toBe(0);
      expect(posU1.targetY).toBe(0);

      expect(posU2.targetX).toBe(100 + gap); // 110
      expect(posU2.targetY).toBe(0);

      // u3 goes to col 0 below u1
      expect(posU3.targetX).toBe(0);
      expect(posU3.targetY).toBe(100 + gap); // 110

      // u4 goes to col 0 below u3 (since col0 height is 110+80=190, still < col1 height of 200)
      expect(posU4.targetX).toBe(0);
      expect(posU4.targetY).toBe(110 + 80 + gap); // 200
    });
  });

  describe("calculatePackery", () => {
    it("should pack mixed size elements without overlapping and with gap", () => {
      // 4 blocks:
      // a: 100x100
      // b: 100x50
      // c: 100x50
      // d: 200x100
      const a = makeMockUnit("a", 0, 0, 100, 100);
      const b = makeMockUnit("b", 120, 0, 100, 50);
      const c = makeMockUnit("c", 120, 60, 100, 50);
      const d = makeMockUnit("d", 0, 120, 210, 100);
      const units = [a, b, c, d];

      const gap = 10;
      const bounds = {
        minX: 0,
        minY: 0,
        maxX: 210,
        maxY: 220,
        width: 210, // Fits exactly 2 blocks of 100 + 10 gap = 210
        height: 220,
        midX: 105,
        midY: 110,
      };

      const res = calculatePackery(units, bounds, { gap, containerWidth: 210 });

      expect(res).toHaveLength(4);

      // Verify no two placed items overlap
      for (let i = 0; i < res.length; i++) {
        for (let j = i + 1; j < res.length; j++) {
          const itemA = res[i];
          const itemB = res[j];

          const aX1 = itemA.targetX;
          const aY1 = itemA.targetY;
          const aX2 = aX1 + itemA.unit.box.width;
          const aY2 = aY1 + itemA.unit.box.height;

          const bX1 = itemB.targetX;
          const bY1 = itemB.targetY;
          const bX2 = bX1 + itemB.unit.box.width;
          const bY2 = bY1 + itemB.unit.box.height;

          const isOverlapping =
            aX1 < bX2 && aX2 > bX1 && aY1 < bY2 && aY2 > bY1;

          expect(isOverlapping).toBe(false);
        }
      }
    });
  });

  describe("layoutElements integration", () => {
    it("should mutate elements and maintain atomicity", () => {
      const u1 = makeMockUnit("e1", 0, 0, 50, 50);
      const u2 = makeMockUnit("e2", 200, 0, 50, 50);
      const elements = [u1.elements[0], u2.elements[0]];

      const elementsMap = new Map([
        ["e1", elements[0]],
        ["e2", elements[1]],
      ]);

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

      const updated = layoutElements(
        elements,
        elementsMap as any,
        "distributeHorizontal",
        { gap: 20 },
        appState,
        mockScene,
      );

      expect(updated).toHaveLength(2);
      expect(elements[0].x).toBe(0);
      expect(elements[1].x).toBe(50 + 20); // 70
    });
  });
});
