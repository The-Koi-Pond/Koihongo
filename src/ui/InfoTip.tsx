import { Info, type LucideIcon } from "lucide-react";

/**
 * A small button that shows a bubble while hovered or focused (so it also works
 * by keyboard, and a click keeps it open until focus moves on).
 */
export function InfoTip({
  label,
  children,
  icon: Icon = Info,
  placement = "above",
  align = "center",
  buttonClassName = "info-tip-btn",
}: {
  /** What the button is for, read out by screen readers. */
  label: string;
  /** The bubble's content. */
  children: React.ReactNode;
  icon?: LucideIcon;
  placement?: "above" | "below";
  /** "end" lines the bubble up with the button's right edge (for buttons near the window edge). */
  align?: "center" | "end";
  buttonClassName?: string;
}) {
  return (
    <span className={`info-tip ${placement} ${align}`}>
      <button type="button" className={buttonClassName} aria-label={label}>
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      <span className="info-tip-bubble" role="tooltip">
        {children}
      </span>
    </span>
  );
}
