/**
 * sRGB channel triple in 0–255 range.
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * HSL triple with hue in degrees and saturation/lightness in 0–100 percent.
 */
export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/**
 * HSV triple with hue in degrees and saturation/value in 0–100 percent.
 */
export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

/**
 * CMYK channel percentages in 0–100 range.
 */
export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
}

/**
 * All display formats derived from a sampled hex color.
 */
export interface ColorFormats {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
  cmyk: string;
  name: string;
}

/**
 * Normalizes a CSS hex string to uppercase `#RRGGBB`.
 *
 * Accepts 3-digit (`#RGB`), 6-digit (`#RRGGBB`), and 8-digit (`#RRGGBBAA`)
 * forms. Alpha digits are discarded so RGB conversion stays opaque.
 *
 * @param hex - Hex color with or without `#`.
 * @returns Normalized six-digit hex, or null when invalid.
 */
export function normalizeHex(hex: string): string | null {
  const trimmed = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const expanded = trimmed
      .split("")
      .map((ch) => `${ch}${ch}`)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{8}$/.test(trimmed)) {
    return `#${trimmed.slice(0, 6).toUpperCase()}`;
  }
  return null;
}

/**
 * Formats an RGB channel triple as an uppercase `#RRGGBB` hex string.
 *
 * @param rgb - sRGB channels in 0–255 (values are clamped and rounded).
 * @returns Six-digit hex string.
 */
export function rgbToHex(rgb: RgbColor): string {
  const toHex = (value: number): string => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Parses a `rgb()` / `rgba()` CSS color string into `#RRGGBB`.
 *
 * @param value - Trimmed color string.
 * @returns Normalized hex, or null when the string is not rgb/rgba.
 */
function parseRgbFunction(value: string): string | null {
  const match =
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i.exec(value);
  if (match == null) {
    return null;
  }
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
    return null;
  }
  return rgbToHex({ r, g, b });
}

/**
 * Sanitizes a value from the EyeDropper API (or any caller) into `#RRGGBB`.
 *
 * EyeDropper implementations vary: values may be 6- or 8-digit hex, or an
 * `rgb()` / `rgba()` string depending on the Chromium/Electron build. This
 * accepts all of those and discards any alpha channel.
 *
 * @param raw - Unknown input, typically `result.sRGBHex`.
 * @returns Normalized six-digit hex, or null when the value is not a usable color.
 */
export function parseEyeDropperHex(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return normalizeHex(trimmed) ?? parseRgbFunction(trimmed);
}

/**
 * Parses a hex color into 0–255 RGB channels.
 *
 * @param hex - Hex color string (`#RGB` or `#RRGGBB`).
 * @returns RGB channels, or null when the input is not a valid hex color.
 */
export function hexToRgb(hex: string): RgbColor | null {
  const normalized = normalizeHex(hex);
  if (normalized == null) {
    return null;
  }
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/**
 * Converts RGB channels to HSL.
 *
 * @param rgb - sRGB channels in 0–255.
 * @returns HSL with rounded integer components matching common eyedropper UIs.
 */
export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts RGB channels to HSV.
 *
 * @param rgb - sRGB channels in 0–255.
 * @returns HSV with rounded integer components matching common eyedropper UIs.
 */
export function rgbToHsv(rgb: RgbColor): HsvColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const s = max === 0 ? 0 : delta / max;
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(max * 100),
  };
}

/**
 * Converts RGB channels to CMYK percentages.
 *
 * @param rgb - sRGB channels in 0–255.
 * @returns CMYK percentages rounded to whole numbers.
 */
export function rgbToCmyk(rgb: RgbColor): CmykColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

/**
 * Formats RGB channels as `rgb(r, g, b)`.
 *
 * @param rgb - sRGB channels in 0–255.
 * @returns CSS-like rgb string.
 */
export function formatRgb(rgb: RgbColor): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Formats HSL as `hsl(h, s%, l%)`.
 *
 * @param hsl - HSL components.
 * @returns CSS-like hsl string.
 */
export function formatHsl(hsl: HslColor): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Formats HSV as `hsv(h, s%, v%)`.
 *
 * @param hsv - HSV components.
 * @returns hsv string matching common eyedropper UIs.
 */
export function formatHsv(hsv: HsvColor): string {
  return `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`;
}

/**
 * Formats CMYK as `cmyk(c%, m%, y%, k%)`.
 *
 * @param cmyk - CMYK percentages.
 * @returns cmyk string matching common eyedropper UIs.
 */
export function formatCmyk(cmyk: CmykColor): string {
  return `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
}

/** Basic CSS named colors used for a friendly display label. */
const CSS_NAMED_COLORS: Record<string, string> = {
  "#000000": "Black",
  "#FFFFFF": "White",
  "#FF0000": "Red",
  "#00FF00": "Lime",
  "#0000FF": "Blue",
  "#FFFF00": "Yellow",
  "#00FFFF": "Cyan",
  "#FF00FF": "Magenta",
  "#C0C0C0": "Silver",
  "#808080": "Gray",
  "#800000": "Maroon",
  "#808000": "Olive",
  "#008000": "Green",
  "#800080": "Purple",
  "#008080": "Teal",
  "#000080": "Navy",
  "#FFA500": "Orange",
  "#A52A2A": "Brown",
  "#FFC0CB": "Pink",
};

/**
 * Looks up a basic CSS color name for a hex value.
 *
 * @param hex - Normalized `#RRGGBB` hex.
 * @returns Friendly name, or `"Not named"` when no exact match exists.
 */
export function namedColor(hex: string): string {
  const normalized = normalizeHex(hex);
  if (normalized == null) {
    return "Not named";
  }
  return CSS_NAMED_COLORS[normalized] ?? "Not named";
}

/**
 * Builds all copyable format strings from a sampled hex color.
 *
 * @param hex - Hex color from the eyedropper (`#RGB` / `#RRGGBB` / `#RRGGBBAA`).
 * @returns Format bag, or null when hex is invalid.
 */
export function formatsFromHex(hex: string): ColorFormats | null {
  const normalized = parseEyeDropperHex(hex);
  if (normalized == null) {
    return null;
  }
  const rgb = hexToRgb(normalized);
  if (rgb == null) {
    return null;
  }
  return {
    hex: normalized,
    rgb: formatRgb(rgb),
    hsl: formatHsl(rgbToHsl(rgb)),
    hsv: formatHsv(rgbToHsv(rgb)),
    cmyk: formatCmyk(rgbToCmyk(rgb)),
    name: namedColor(normalized),
  };
}
