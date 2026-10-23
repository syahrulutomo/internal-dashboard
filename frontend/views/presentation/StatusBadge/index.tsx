import { Badge } from "@/views/ui/Badge";
import type { PaymentStatus } from "@/libs/types";

const config: Record<
  PaymentStatus,
  { tone: "success" | "warning" | "danger"; label: string; dot: string }
> = {
  completed: { tone: "success", label: "Completed", dot: "bg-brand-500" },
  processing: { tone: "warning", label: "Processing", dot: "bg-amber-500" },
  failed: { tone: "danger", label: "Failed", dot: "bg-red-500" },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const { tone, label, dot } = config[status] ?? config.processing;
  return (
    <Badge tone={tone}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </Badge>
  );
}
