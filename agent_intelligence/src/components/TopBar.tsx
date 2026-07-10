import { formatEffectiveDate } from "@/lib/format";

// Top header bar — the shell strip above every app screen (design handoff
// §Shell). Replaces the old ScopeStrip: page title · divider · scope chips ·
// right-aligned data-freshness meta. Presentational only; pages pass the
// same profile-derived scope they previously fed ScopeStrip.

export type ScopeChip = {
  // Tabler glyph name without the "ti-" prefix ("map-pin", "briefcase").
  icon: "map-pin" | "briefcase";
  label: string;
};

type Props = {
  title: string;
  chips?: ScopeChip[];
  // "YYYY-MM-DD" (the API's asOf / data/last_updated.txt). Omitted while a
  // client page is still loading — the meta simply doesn't render yet.
  asOf?: string;
};

export default function TopBar({ title, chips = [], asOf }: Props): React.JSX.Element {
  return (
    <div
      data-testid="top-bar"
      className="bg-surface border-b border-card-line px-4 md:px-8 py-3.5
                 flex items-center gap-4 flex-wrap"
    >
      <span className="text-15 font-[650] text-ink" data-testid="page-title">
        {title}
      </span>

      {chips.length > 0 && (
        <span className="w-px h-[18px] bg-card-line hidden sm:block" aria-hidden />
      )}

      {chips.map(chip => (
        <span
          key={`${chip.icon}-${chip.label}`}
          data-testid="scope-chip"
          className="inline-flex items-center gap-1.5 bg-soft rounded-full
                     px-3 py-1 text-12 text-ink-mid"
        >
          <i className={`ti ti-${chip.icon} text-13`} aria-hidden />
          {chip.label}
        </span>
      ))}

      {asOf && (
        <span className="ml-auto text-12 text-ink-3" data-testid="data-as-of">
          Data as of {formatEffectiveDate(asOf)} · refreshes monthly
        </span>
      )}
    </div>
  );
}
