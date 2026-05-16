"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  targetDate: string;
  label: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function CountdownTimer({ targetDate, label }: Props) {
  const t = useTranslations("contests");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(targetDate).getTime();

    function tick() {
      const diff = target - Date.now();
      setRemaining(Math.max(0, diff));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (remaining === null) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="text-sm text-muted-foreground">
      <span className="mr-1">{label}</span>
      {days > 0 && (
        <span className="font-mono font-medium text-foreground">
          {days}
          {t("days")}{" "}
        </span>
      )}
      <span className="font-mono font-medium text-foreground">
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}
