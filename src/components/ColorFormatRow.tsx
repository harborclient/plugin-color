interface Props {
  /**
   * Accessible name for the format (for example "Hex").
   */
  label: string;

  /**
   * Formatted color string shown and copied.
   */
  value: string;

  /**
   * Copies the format value when the user activates the copy control.
   */
  onCopy: () => void;
}

/**
 * Copyable color format row: monospace value plus an accessible copy button.
 */
export function ColorFormatRow({ label, value, onCopy }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-separator bg-panel px-3 py-2">
      <span
        className="min-w-0 flex-1 truncate font-mono text-[14px] text-text"
        title={value}
      >
        {value}
      </span>
      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-selection hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={onCopy}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </div>
  );
}
