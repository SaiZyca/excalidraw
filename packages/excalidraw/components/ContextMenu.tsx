import clsx from "clsx";
import React from "react";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";

import { useExcalidrawAppState, useExcalidrawElements } from "./App";

import { Popover } from "./Popover";

import "./ContextMenu.scss";

import type { ActionManager } from "../actions/manager";
import type { ShortcutName } from "../actions/shortcuts";
import type { Action } from "../actions/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppClassProperties, AppState } from "../types";

import type { TranslationKeys } from "../i18n";

export type ContextMenuSubmenu = {
  type: "submenu";
  name: string;
  label:
    | TranslationKeys
    | ((
        elements: readonly ExcalidrawElement[],
        appState: Readonly<AppState>,
        app: AppClassProperties,
      ) => string);
  items: ContextMenuItems;
  predicate?: (
    elements: readonly ExcalidrawElement[],
    appState: Readonly<AppState>,
    props: any,
    app: AppClassProperties,
  ) => boolean;
};

export type ContextMenuItem =
  | typeof CONTEXT_MENU_SEPARATOR
  | Action
  | ContextMenuSubmenu;

export type ContextMenuItems = (ContextMenuItem | false | null | undefined)[];

type ContextMenuProps = {
  actionManager: ActionManager;
  items: ContextMenuItems;
  top: number;
  left: number;
  onClose: (callback?: () => void) => void;
};

export const CONTEXT_MENU_SEPARATOR = "separator";

const isSubmenu = (item: ContextMenuItem): item is ContextMenuSubmenu =>
  Boolean(
    item &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "submenu",
  );

export const ContextMenu = React.memo(
  ({ actionManager, items, top, left, onClose }: ContextMenuProps) => {
    const appState = useExcalidrawAppState();
    const elements = useExcalidrawElements();
    const [activeSubmenu, setActiveSubmenu] = React.useState<string | null>(
      null,
    );

    const filteredItems = items.reduce((acc: ContextMenuItem[], item) => {
      if (
        item &&
        (item === CONTEXT_MENU_SEPARATOR ||
          !item.predicate ||
          item.predicate(
            elements,
            appState,
            actionManager.app.props,
            actionManager.app,
          ))
      ) {
        acc.push(item);
      }
      return acc;
    }, []);

    const renderSubmenuItems = (subItems: ContextMenuItems) => {
      const filtered = subItems.reduce((acc: Action[], subItem) => {
        if (
          subItem &&
          subItem !== CONTEXT_MENU_SEPARATOR &&
          !isSubmenu(subItem) &&
          (!subItem.predicate ||
            subItem.predicate(
              elements,
              appState,
              actionManager.app.props,
              actionManager.app,
            ))
        ) {
          acc.push(subItem as Action);
        }
        return acc;
      }, []);

      return filtered.map((subAction, subIdx) => {
        let subLabel = "";
        if (subAction.label) {
          if (typeof subAction.label === "function") {
            subLabel = t(
              subAction.label(
                elements,
                appState,
                actionManager.app,
              ) as unknown as TranslationKeys,
            );
          } else {
            subLabel = t(subAction.label as unknown as TranslationKeys);
          }
        }

        return (
          <li
            key={subIdx}
            data-testid={subAction.name}
            onClick={(e) => {
              e.stopPropagation();
              onClose(() => {
                actionManager.executeAction(subAction, "contextMenu");
              });
            }}
          >
            <button
              type="button"
              className={clsx("context-menu-item", {
                checkmark: subAction.checked?.(appState),
              })}
            >
              <div className="context-menu-item__label">{subLabel}</div>
              <kbd className="context-menu-item__shortcut">
                {subAction.name
                  ? getShortcutFromShortcutName(
                      subAction.name as ShortcutName,
                    )
                  : ""}
              </kbd>
            </button>
          </li>
        );
      });
    };

    return (
      <Popover
        onCloseRequest={() => {
          onClose();
        }}
        top={top}
        left={left}
        fitInViewport={true}
        viewportWidth={appState.width}
        viewportHeight={appState.height}
        className="context-menu-popover"
      >
        <ul
          className="context-menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {filteredItems.map((item, idx) => {
            if (item === CONTEXT_MENU_SEPARATOR) {
              if (
                !filteredItems[idx - 1] ||
                filteredItems[idx - 1] === CONTEXT_MENU_SEPARATOR
              ) {
                return null;
              }
              return <hr key={idx} className="context-menu-item-separator" />;
            }

            if (isSubmenu(item)) {
              let label = "";
              if (item.label) {
                if (typeof item.label === "function") {
                  label = t(
                    item.label(
                      elements,
                      appState,
                      actionManager.app,
                    ) as unknown as TranslationKeys,
                  );
                } else {
                  label = t(item.label as unknown as TranslationKeys);
                }
              }

              return (
                <li
                  key={idx}
                  data-testid={item.name}
                  className="context-menu-item-container"
                  onMouseEnter={() => setActiveSubmenu(item.name)}
                >
                  <button
                    type="button"
                    className="context-menu-item context-menu-item--submenu"
                  >
                    <div className="context-menu-item__label">{label}</div>
                    <span className="context-menu-item__arrow">▶</span>
                  </button>
                  {activeSubmenu === item.name && (
                    <ul
                      className="context-menu context-submenu"
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      {renderSubmenuItems(item.items)}
                    </ul>
                  )}
                </li>
              );
            }

            const actionName = item.name;
            let label = "";
            if (item.label) {
              if (typeof item.label === "function") {
                label = t(
                  item.label(
                    elements,
                    appState,
                    actionManager.app,
                  ) as unknown as TranslationKeys,
                );
              } else {
                label = t(item.label as unknown as TranslationKeys);
              }
            }

            return (
              <li
                key={idx}
                data-testid={actionName}
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  // we need update state before executing the action in case
                  // the action uses the appState it's being passed (that still
                  // contains a defined contextMenu) to return the next state.
                  onClose(() => {
                    actionManager.executeAction(item, "contextMenu");
                  });
                }}
              >
                <button
                  type="button"
                  className={clsx("context-menu-item", {
                    dangerous: actionName === "deleteSelectedElements",
                    checkmark: item.checked?.(appState),
                  })}
                >
                  <div className="context-menu-item__label">{label}</div>
                  <kbd className="context-menu-item__shortcut">
                    {actionName
                      ? getShortcutFromShortcutName(
                          actionName as ShortcutName,
                        )
                      : ""}
                  </kbd>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    );
  },
);
