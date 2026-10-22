import { Moon } from "lucide-react";
import { useEffect, useState } from "react";

// Gentle encouragement, one per day; English shows on hover.
const MESSAGES: { ja: string; en: string }[] = [
  { ja: "今日もちょっとずつ、できるよ ♡", en: "A little at a time today too, you can do it" },
  { ja: "ゆっくりでいいよ ☆", en: "Slow is fine" },
  { ja: "一歩ずつ、ね ♪", en: "One step at a time" },
];

function dayNumber(d: Date): number {
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
}

/** The bar along the bottom of Today: a daily encouraging line, and the date and time. */
export function StatusBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const message = MESSAGES[dayNumber(now) % MESSAGES.length];
  return (
    <footer className="status-bar">
      <Moon size={16} fill="#ffe08a" color="#ffe08a" aria-hidden="true" />
      <p lang="ja" className="status-message" title={message.en}>
        {message.ja}
      </p>
      <time className="status-clock" dateTime={now.toISOString()}>
        <span className="status-date">{now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
        {" · "}
        {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </time>
    </footer>
  );
}
