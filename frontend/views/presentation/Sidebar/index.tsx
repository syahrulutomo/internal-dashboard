import { CardIcon, PulseIcon } from "@/views/ui/Icons";

// Static navigation chrome. "Payments" is the only wired destination; the
// sidebar frames the monitoring workspace.
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-brand-900 px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-800 text-white">
          <PulseIcon className="size-5 text-brand-300" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">
            DurianPay Internal
          </p>
          <p className="text-xs text-neutral-400">Payments dashboard</p>
        </div>
      </div>

      <p className="mt-9 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Monitoring
      </p>
      <nav className="mt-2 flex flex-col gap-1">
        <span
          aria-current="page"
          className="flex cursor-default items-center gap-3 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700"
        >
          <CardIcon className="size-5" />
          Payments
        </span>
      </nav>
    </aside>
  );
}
