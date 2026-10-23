import { PulseIcon } from "@/views/ui/Icons";

// The branded left panel of the login screen. Purely decorative — static copy
// and a sample status-breakdown card that previews the dashboard.
export function LoginHero() {
  return (
    <div className="relative hidden overflow-hidden rounded-3xl bg-brand-900 p-10 text-white lg:flex lg:flex-col xl:p-12">
      {/* Soft decorative squares in the background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <span className="absolute -right-10 top-24 size-40 rotate-12 rounded-[2rem] bg-white/5" />
        <span className="absolute right-24 top-6 size-24 rotate-6 rounded-3xl bg-white/5" />
        <span className="absolute bottom-40 right-16 size-28 -rotate-6 rounded-3xl bg-white/5" />
      </div>

      <div className="relative flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-brand-200">
          <PulseIcon className="size-5 text-brand-300" />
        </span>
        <span className="text-lg font-semibold">DurianPay Internal</span>
      </div>

      <div className="relative mt-auto max-w-md">
        <h2 className="text-4xl font-semibold leading-tight xl:text-5xl">
          Every incoming payment, in one view.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-brand-100/80">
          Track what&apos;s completed, still processing, or failed across all
          merchants, so the team can act before customers notice.
        </p>
      </div>
    </div>
  );
}
