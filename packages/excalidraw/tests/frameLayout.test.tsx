import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { Excalidraw } from "../index";
import { render, unmountComponent } from "./test-utils";
import { API } from "./helpers/api";
import { UI, Pointer } from "./helpers/ui";
import {
  actionWrapInAutoLayoutFramePackery,
  actionSetFrameLayoutMasonry,
} from "../actions/actionFrameLayout";
import type { ExcalidrawFrameElement, NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { newFrameElement } from "@excalidraw/element";

const mouse = new Pointer("mouse");
const { h } = window;

describe("Auto-layout Frame Actions", () => {
  beforeEach(async () => {
    unmountComponent();
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("should wrap multiple elements in an auto-layout packery frame", async () => {
    // Create 2 rectangles
    UI.clickTool("rectangle");
    mouse.down(100, 100);
    mouse.up(200, 180);
    mouse.reset();

    UI.clickTool("rectangle");
    mouse.down(300, 100);
    mouse.up(400, 180);
    mouse.reset();

    expect(h.elements.length).toBe(2);

    API.setSelectedElements(h.elements as NonDeletedExcalidrawElement[]);

    // Execute wrap in packery frame
    API.executeAction(actionWrapInAutoLayoutFramePackery);

    // 2 children + 1 frame
    expect(h.elements.length).toBe(3);

    const frame = h.elements.find((el) => el.type === "frame") as ExcalidrawFrameElement;
    expect(frame).toBeDefined();
    expect(frame.layoutMode).toBe("packery");

    // Both children should belong to the frame
    const children = h.elements.filter((el) => el.frameId === frame.id);
    expect(children.length).toBe(2);
  });

  it("should switch layout mode to masonry on an existing frame", async () => {
    const frame = newFrameElement({
      x: 50,
      y: 50,
      width: 300,
      height: 200,
      layoutMode: "none",
    });

    h.app.scene.replaceAllElements([...h.elements, frame]);
    expect(h.elements.find((el) => el.id === frame.id)).toBeDefined();

    API.setSelectedElements([frame]);

    API.executeAction(actionSetFrameLayoutMasonry);

    const updatedFrame = h.elements.find((el) => el.id === frame.id) as ExcalidrawFrameElement;
    expect(updatedFrame.layoutMode).toBe("masonry");
  });
});
