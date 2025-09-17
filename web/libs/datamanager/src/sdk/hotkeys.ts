import { useHotkeys } from "react-hotkeys-hook";
import { toStudlyCaps } from "@humansignal/core";
import { keymap } from "./keymap";

export type Hotkey = {
  title: string;
  shortcut?: string;
  macos?: string;
  other?: string;
};

const readableShortcut = (shortcut: string | null | undefined) => {
  if (!shortcut || typeof shortcut !== "string") {
    return "";
  }

  return shortcut
    .split("+")
    .map((str) => toStudlyCaps(str))
    .join(" + ");
};

export const useShortcut = (
  actionName: keyof typeof keymap,
  callback: () => void,
  options = { showShortcut: true },
  dependencies = undefined,
) => {
  const action = keymap[actionName] as Hotkey;
  const isMacos = /mac/i.test(navigator.platform);

  let shortcut = action.shortcut ?? ((isMacos ? action.macos : action.other) as string);

  // Check for custom shortcut in app settings
  const customMapping = window.APP_SETTINGS?.lookupHotkey?.(`data_manager:${actionName}`);
  if (customMapping) {
    // Explicitly use the custom key even if it's null
    shortcut = customMapping.key;
  }

  useHotkeys(
    shortcut,
    () => {
      callback();
    },
    {
      keyup: false,
      element: document.body,
    } as any,
    dependencies,
  );

  const title = action.title + (options.showShortcut ? `: [ ${readableShortcut(shortcut)} ]` : "");

  return title;
};
