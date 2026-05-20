"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ContestStatus } from "@/lib/types";

interface Props {
  status: ContestStatus;
}

const VARIANT: Record<ContestStatus, "default" | "secondary" | "outline"> = {
  upcoming: "secondary",
  ongoing: "default",
  past: "outline",
};

export function ContestStatusBadge({ status }: Props) {
  const t = useTranslations("contests");
  return <Badge variant={VARIANT[status]}>{t(status as Parameters<typeof t>[0])}</Badge>;
}
