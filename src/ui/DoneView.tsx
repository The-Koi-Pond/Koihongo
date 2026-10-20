import { BannerScene } from "./Scene.tsx";

/** End of a session (or nothing to do): a message in the night-sky banner, with actions. */
export function DoneView({ title, children, actions }: { title: string; children?: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="fit-page">
      <header className="banner bleed done-banner">
        <BannerScene />
        <div className="done-content">
          <h1>{title}</h1>
          {children}
          <div className="done-actions">{actions}</div>
        </div>
      </header>
    </div>
  );
}
