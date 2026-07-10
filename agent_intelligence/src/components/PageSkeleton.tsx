// Structural skeleton shown during initial page load. Low-contrast gray
// rectangles in the rough shape of the real page — no shimmer animation,
// no spinner, no text. Goal: register as "the page is loading" without
// distracting the eye on fast connections.
//
// Two variants (shapes match the refreshed layouts):
//   - "overview" — top bar + 3 summary cards + a state-grouped feed card
//   - "table"    — top bar + intro line + filter chips + list-card with
//                  header band and row stripes (/prospect, /defend,
//                  /my-carriers)

type Props = { variant: "overview" | "table" };

export default function PageSkeleton({ variant }: Props): React.JSX.Element {
  return (
    <main
      data-testid="page-skeleton"
      data-variant={variant}
      className="min-h-screen bg-canvas"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Top header bar placeholder (title · chips · right meta) */}
      <div className="bg-surface border-b border-card-line px-4 md:px-8 py-3.5 flex items-center gap-4">
        <Bar w={80} h={15} strong />
        <Bar w={110} h={22} radius={999} />
        <span className="ml-auto">
          <Bar w={200} h={12} />
        </span>
      </div>

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        {/* Intro line */}
        <div className="mb-5">
          <Bar w={340} h={13} />
        </div>

        {variant === "overview" ? <OverviewSkeleton /> : <TableSkeleton />}
      </div>
    </main>
  );
}

function OverviewSkeleton(): React.JSX.Element {
  return (
    <>
      {/* 3 summary cards across */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="border border-card-line rounded-card p-5 bg-surface shadow-card min-h-[120px]"
          >
            <Bar w={90} h={11} />
            <div className="h-3.5" />
            <div className="flex items-baseline gap-2.5 mb-2">
              <Bar w={36} h={26} strong />
              <Bar w={100} h={12} />
            </div>
            <div className="flex items-baseline gap-2.5">
              <Bar w={36} h={26} strong />
              <Bar w={80} h={12} />
            </div>
          </div>
        ))}
      </div>

      {/* Feed heading + grouped feed card */}
      <div className="flex justify-between items-baseline mb-3.5">
        <Bar w={150} h={18} strong />
        <Bar w={120} h={12} />
      </div>
      <Bar w={110} h={11} />
      <div className="h-2" />
      <div className="border border-card-line rounded-card bg-surface shadow-card overflow-hidden">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={[
              "flex justify-between items-center px-[22px] py-4",
              i === 4 ? "" : "border-b border-line",
            ].join(" ")}
          >
            <div>
              <Bar w={90} h={14} strong />
              <div className="h-1.5" />
              <Bar w={170} h={12} />
            </div>
            <div className="flex items-center gap-3.5">
              <Bar w={52} h={16} strong />
              <Bar w={72} h={20} radius={999} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TableSkeleton(): React.JSX.Element {
  return (
    <>
      {/* Filter chip row + right summary */}
      <div className="flex gap-2 mb-4 items-center">
        <Bar w={44} h={11} />
        <Bar w={120} h={26} radius={999} />
        <Bar w={92} h={26} radius={999} />
        <Bar w={140} h={26} radius={999} />
        <Bar w={130} h={26} radius={999} />
        <span className="ml-auto">
          <Bar w={220} h={13} />
        </span>
      </div>

      {/* List-card: header band + row stripes + footer strip */}
      <div className="border border-card-line rounded-card bg-surface shadow-card overflow-hidden">
        <div className="bg-surface-2 border-b border-line px-[22px] py-3 flex justify-between">
          {[70, 70, 50, 50, 90].map((w, i) => (
            <Bar key={i} w={w} h={11} />
          ))}
        </div>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={[
              "flex justify-between items-center px-[22px] py-[15px]",
              i === 3 ? "" : "border-b border-line",
            ].join(" ")}
          >
            <div>
              <Bar w={110} h={15} strong />
              <div className="h-1.5" />
              <Bar w={160} h={12} />
            </div>
            <Bar w={90} h={28} radius={7} />
            <Bar w={70} h={12} />
            <Bar w={56} h={16} strong />
            <Bar w={42} h={13} />
          </div>
        ))}
        <div className="bg-surface-2 border-t border-line px-[22px] py-3">
          <Bar w={320} h={12} />
        </div>
      </div>
    </>
  );
}

// One gray rectangle. `strong` = slightly darker for emphasis (titles,
// big numbers); `radius` defaults to 4.
function Bar({
  w,
  h,
  strong,
  radius,
}: {
  w: number;
  h: number;
  strong?: boolean;
  radius?: number;
}): React.JSX.Element {
  return (
    <div
      className={strong ? "bg-skeleton-strong" : "bg-skeleton"}
      style={{
        width: w,
        height: h,
        borderRadius: radius ?? 4,
      }}
    />
  );
}
