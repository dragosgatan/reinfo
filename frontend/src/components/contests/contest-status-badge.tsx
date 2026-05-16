import { Badge } from "@/components/ui/badge";
import type { ContestStatus } from "@/lib/types";

interface Props {
  status: ContestStatus;
}

const CONFIG: Record<ContestStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  upcoming: { label: "Viitor", variant: "secondary" },
  ongoing: { label: "Activ", variant: "default" },
  past: { label: "Trecut", variant: "outline" },
};

export function ContestStatusBadge({ status }: Props) {
  const { label, variant } = CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
