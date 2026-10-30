import { describe, expect, it } from "vitest";
import { detectPlatform, keysFor, shortcutText } from "./platform";

describe("detectPlatform", () => {
  it("tells Mac, Windows and the rest apart", () => {
    expect(detectPlatform({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(detectPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe("mac");
    expect(detectPlatform({ userAgentData: { platform: "Windows" } })).toBe("windows");
    expect(detectPlatform({ platform: "Win32" })).toBe("windows");
    expect(detectPlatform({ platform: "Linux x86_64" })).toBe("other");
  });
});

describe("keysFor and shortcutText", () => {
  it("shows Mac symbols on a Mac, names elsewhere, both before it is known", () => {
    expect(keysFor(["⌥", "⇧", "P"], "mac")).toEqual(["⌥", "⇧", "P"]);
    expect(keysFor(["⌥", "⇧", "P"], "windows")).toEqual(["Alt", "Shift", "P"]);
    expect(keysFor(["⌘", "K"], null)).toEqual(["⌘/Ctrl", "K"]);
    expect(shortcutText(["⌘", "⇧", "M"], "mac")).toBe("⌘⇧M");
    expect(shortcutText(["⌘", "⇧", "M"], "windows")).toBe("Ctrl+Shift+M");
  });
});
