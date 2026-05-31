import { describe, expect, it, vi } from "vitest";
import { DAY_MAP_STYLES, NIGHT_MAP_STYLES } from "./constants.js";
import {
  MAP_DAY_BASE,
  MAP_DAY_HIGHWAY,
  MAP_DAY_HIGHWAY_STROKE,
  MAP_DAY_LOCAL_ROAD,
  MAP_DAY_PARK,
  MAP_DAY_WATER,
  MAP_NIGHT_BASE,
  MAP_NIGHT_WATER,
} from "./palette.js";
import { applyMapThemeStyles, resolveMapStyles } from "./mapStyles.js";

describe("mapStyles", () => {
  it("resolves day and night palettes for standard map style", () => {
    expect(resolveMapStyles("standard", "day")).toBe(DAY_MAP_STYLES);
    expect(resolveMapStyles("standard", "night")).toBe(NIGHT_MAP_STYLES);
  });

  it("day styles distinguish land, highway, local roads, and water", () => {
    const colors = DAY_MAP_STYLES.flatMap(rule =>
      (rule.stylers || []).map(s => s.color).filter(Boolean),
    );
    expect(colors).toContain(MAP_DAY_BASE);
    expect(colors).toContain(MAP_DAY_HIGHWAY);
    expect(colors).toContain(MAP_DAY_LOCAL_ROAD);
    expect(colors).toContain(MAP_DAY_WATER);
    expect(MAP_DAY_BASE).toBe("#F0EDE8");
    expect(MAP_DAY_HIGHWAY).toBe("#E06820");
    expect(MAP_DAY_HIGHWAY_STROKE).toBe("#5A2A10");
    expect(MAP_DAY_WATER).toBe("#4A8AB8");
    expect(MAP_DAY_PARK).toBe("#6B8F5E");
  });

  it("night styles use deep land and darker water", () => {
    const colors = NIGHT_MAP_STYLES.flatMap(rule =>
      (rule.stylers || []).map(s => s.color).filter(Boolean),
    );
    expect(colors).toContain(MAP_NIGHT_BASE);
    expect(colors).toContain(MAP_NIGHT_WATER);
  });

  it("applyMapThemeStyles updates a map instance", () => {
    const map = { setOptions: vi.fn() };
    applyMapThemeStyles(map, "standard", "day");
    expect(map.setOptions).toHaveBeenCalledWith({ styles: DAY_MAP_STYLES ?? [] });
  });
});
