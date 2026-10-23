import { Button } from "@/views/ui/Button";
import { DownloadIcon, RefreshIcon } from "@/views/ui/Icons";

interface PaymentsHeaderProps {
  updatedLabel: string | null;
  refreshing?: boolean;
  onRefresh: () => void;
  onExport: () => void;
  exportDisabled?: boolean;
  // RBAC: whether the current role may export. When false the Export CTA is not
  // rendered at all (the server still enforces this — see libs/permissions.ts).
  canExport?: boolean;
}

export function PaymentsHeader({
  updatedLabel,
  refreshing,
  onRefresh,
  onExport,
  exportDisabled,
  canExport = false,
}: PaymentsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Payments</h1>
        </div>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          Monitor incoming payments across every merchant.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {updatedLabel && (
          <span className="hidden text-sm text-[var(--muted)] md:inline">
            Updated {updatedLabel}
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          loading={refreshing}
        >
          {!refreshing && <RefreshIcon className="size-4" />}
          Refresh
        </Button>
        {canExport && (
          <Button size="sm" onClick={onExport} disabled={exportDisabled}>
            <DownloadIcon className="size-4" />
            Export CSV
          </Button>
        )}
      </div>
    </div>
  );
}
