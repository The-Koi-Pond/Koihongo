import type { LucideIcon } from "lucide-react";

/** A Today card's header: a starry band with an icon and the title (styles: .tile-title in App.css). */
export function CardTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="tile-title">
      <Icon className="tile-title-icon" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </h2>
  );
}
