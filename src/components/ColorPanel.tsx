import { Button, Input } from "@harborclient/sdk/components";
import { copyToClipboard } from "@harborclient/sdk/clipboard";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "@harborclient/sdk/react";
import type { PluginContext } from "@harborclient/sdk";
import {
  formatsFromHex,
  parseEyeDropperHex,
  type ColorFormats,
} from "../color/convert";
import { ColorFormatRow } from "./ColorFormatRow";

const RECENT_STORAGE_KEY = "recent";
const MAX_RECENT = 8;
const DEFAULT_HEX = "#3C3C3C";

/**
 * Minimal EyeDropper surface available in Chromium / Electron.
 */
interface EyeDropperResult {
  sRGBHex: string;
}

/**
 * Options accepted by `EyeDropper.open`, including an optional abort signal.
 */
interface EyeDropperOpenOptions {
  signal?: AbortSignal;
}

/**
 * Constructor shape for the Web EyeDropper API.
 */
interface EyeDropperConstructor {
  new (): { open(options?: EyeDropperOpenOptions): Promise<EyeDropperResult> };
}

interface Props {
  /**
   * Renderer plugin context from the HarborClient host.
   */
  hc: PluginContext;
}

/**
 * Returns whether the Web EyeDropper API is available in this webview.
 */
function isEyeDropperSupported(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

/**
 * Footer Color panel: pick a screen color and copy it in several formats.
 */
export function ColorPanel({ hc }: Props) {
  const [formats, setFormats] = useState<ColorFormats | null>(() =>
    formatsFromHex(DEFAULT_HEX)
  );
  const [customName, setCustomName] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = useMemo(() => isEyeDropperSupported(), []);

  /**
   * Mirrors `recent` so the async picking loop reads the latest list without
   * being re-created (and restarted) on every sampled color.
   */
  const recentRef = useRef<string[]>([]);

  /**
   * Tracks whether continuous picking is active, readable inside the loop.
   */
  const pickingRef = useRef(false);

  /**
   * Aborts the in-flight `EyeDropper.open()` when picking is toggled off or the
   * panel unmounts.
   */
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Loads persisted recent swatches when the panel mounts.
   */
  useEffect(() => {
    let active = true;
    void hc.storage
      .get<string[]>(RECENT_STORAGE_KEY)
      .then((value) => {
        if (!active) {
          return;
        }
        if (Array.isArray(value)) {
          const clean = value.filter((item) => typeof item === "string");
          recentRef.current = clean;
          setRecent(clean);
        }
      })
      .catch(() => {
        if (active) {
          setError("Failed to load recent colors.");
        }
      });
    return () => {
      active = false;
    };
  }, [hc.storage]);

  /**
   * Stops continuous picking and aborts any open eyedropper when the panel
   * unmounts (footer panel closed).
   */
  useEffect(() => {
    return () => {
      pickingRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /**
   * Applies a sampled hex color to the panel and prepends it to recent swatches.
   *
   * Reads/writes recent colors through `recentRef` so it stays stable across the
   * continuous picking loop.
   *
   * @param hex - Hex color from the eyedropper or a recent swatch.
   * @param persist - When true, writes the updated recent list to storage.
   */
  const applyColor = useCallback(
    async (hex: string, persist: boolean): Promise<void> => {
      const next = formatsFromHex(hex);
      if (next == null) {
        setError("Invalid color value.");
        return;
      }
      setFormats(next);
      setCustomName("");
      setError(null);

      const updated = [
        next.hex,
        ...recentRef.current.filter((item) => item.toUpperCase() !== next.hex),
      ].slice(0, MAX_RECENT);
      recentRef.current = updated;
      setRecent(updated);

      if (persist) {
        try {
          await hc.storage.set(RECENT_STORAGE_KEY, updated);
        } catch {
          setError("Failed to save recent colors.");
        }
      }
    },
    [hc.storage]
  );

  /**
   * Opens the eyedropper for a single sample.
   *
   * The Web EyeDropper API consumes transient user activation on every
   * `open()` call, so it must be re-triggered by a fresh click each time —
   * continuous sampling from one gesture is not possible.
   */
  const handlePick = useCallback(async (): Promise<void> => {
    if (!supported) {
      setError("Screen color picking is not supported in this environment.");
      return;
    }
    if (pickingRef.current) {
      return;
    }
    pickingRef.current = true;
    setPicking(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const EyeDropper = (
        window as unknown as { EyeDropper: EyeDropperConstructor }
      ).EyeDropper;
      const result = await new EyeDropper().open({ signal: controller.signal });
      const hex = parseEyeDropperHex(result?.sRGBHex);
      if (hex == null) {
        setError(
          `Invalid color value from eyedropper: ${String(result?.sRGBHex)}`
        );
        return;
      }
      await applyColor(hex, true);
    } catch (err) {
      // AbortError: user pressed Escape or the panel closed mid-pick.
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      // NotAllowedError: transient activation expired/consumed — needs a click.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError('Click "Pick color" to sample again.');
        return;
      }
      setError("Could not sample a color. Try again.");
    } finally {
      pickingRef.current = false;
      abortRef.current = null;
      setPicking(false);
    }
  }, [applyColor, supported]);

  /**
   * Copies one format string and shows a toast on success.
   *
   * @param label - Format label used in the toast.
   * @param value - Text to copy.
   */
  const handleCopy = useCallback(
    (label: string, value: string): void => {
      void copyToClipboard(hc, value, { toast: `Copied ${label}` }).catch(
        () => {
          setError(`Failed to copy ${label}.`);
        }
      );
    },
    [hc]
  );

  /**
   * Reloads a previously sampled color from the recent swatch strip.
   *
   * @param hex - Stored recent hex value.
   */
  const handleRecentClick = useCallback(
    (hex: string): void => {
      void applyColor(hex, false);
    },
    [applyColor]
  );

  const displayName =
    customName.trim().length > 0
      ? customName.trim()
      : formats?.name ?? "Not named";
  const previousHex = recent.find((hex) => hex !== formats?.hex) ?? "#000000";

  return (
    <div className="flex h-full min-h-0 flex-col bg-control">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-separator px-3 py-2 pr-8">
        <div className="flex min-w-0 items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-text"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m2 22 1-1h3l9-9" />
            <path d="M3 21v-3l9-9" />
            <path d="m15 6 3-3 3 3-3 3z" />
            <path d="m14 7 3 3" />
          </svg>
          <h3 className="m-0 text-[14px] font-medium text-text">Eyedropper</h3>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={picking || !supported}
          aria-busy={picking}
          onClick={() => {
            void handlePick();
          }}
        >
          {picking ? "Picking…" : "Pick color"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {!supported ? (
          <p className="mb-3 text-[14px] text-danger" role="status">
            Screen color picking is not available here. The EyeDropper API
            requires Chromium with screen-access permissions.
          </p>
        ) : null}
        {picking ? (
          <p className="mb-3 text-[14px] text-muted" role="status">
            Click anywhere on screen to sample a color, or press Escape to
            cancel.
          </p>
        ) : null}
        {error != null ? (
          <p className="mb-3 text-[14px] text-danger" role="status">
            {error}
          </p>
        ) : null}

        <div className="relative flex gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[14px] text-muted">Name</span>
              <Input
                value={customName}
                placeholder="Optional name"
                aria-label="Color name"
                onChange={(event) => setCustomName(event.target.value)}
              />
            </label>

            {formats != null ? (
              <>
                <ColorFormatRow
                  label="Color name"
                  value={displayName}
                  onCopy={() => handleCopy("color name", displayName)}
                />
                <ColorFormatRow
                  label="Hex"
                  value={formats.hex}
                  onCopy={() => handleCopy("hex", formats.hex)}
                />
                <ColorFormatRow
                  label="RGB"
                  value={formats.rgb}
                  onCopy={() => handleCopy("RGB", formats.rgb)}
                />
                <ColorFormatRow
                  label="HSL"
                  value={formats.hsl}
                  onCopy={() => handleCopy("HSL", formats.hsl)}
                />
                <ColorFormatRow
                  label="HSV"
                  value={formats.hsv}
                  onCopy={() => handleCopy("HSV", formats.hsv)}
                />
                <ColorFormatRow
                  label="CMYK"
                  value={formats.cmyk}
                  onCopy={() => handleCopy("CMYK", formats.cmyk)}
                />
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2 pt-6">
            <div
              className="h-14 w-14 rounded-md border border-separator shadow-sm"
              style={{ backgroundColor: formats?.hex ?? DEFAULT_HEX }}
              role="img"
              aria-label={`Current color ${formats?.hex ?? DEFAULT_HEX}`}
            />
            <button
              type="button"
              className="h-14 w-14 rounded-md border border-separator shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ backgroundColor: previousHex }}
              aria-label={`Previous color ${previousHex}`}
              title={previousHex}
              onClick={() => handleRecentClick(previousHex)}
            />
          </div>
        </div>

        {recent.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[14px] text-muted">Recent</p>
            <div
              className="flex flex-wrap gap-2"
              role="list"
              aria-label="Recent colors"
            >
              {recent.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  role="listitem"
                  className="h-8 w-8 rounded-md border border-separator focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  style={{ backgroundColor: hex }}
                  aria-label={`Use recent color ${hex}`}
                  title={hex}
                  onClick={() => handleRecentClick(hex)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
