// Structural skeleton shown during initial page load. Low-contrast gray
// rectangles in the rough shape of the real page — no shimmer animation,
// no spinner, no text. Goal: register as "the page is loading" without
// distracting the eye on fast connections.
//
// Two variants:
//   - "overview" — header + 4 cards in a row + a feed card
//   - "table"    — scope strip + header + filter chips + header card +
//                  4 table-row stripes (used by /prospect, /defend,
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
      {/* Scope strip placeholder — only the table variant has one */}
      {variant === "table" && (
        <div className="bg-surface-2 px-4 py-2 flex justify-between items-center">
          <Bar w={180} h={14} />
          <Bar w={30} h={14} />
        </div>
      )}

      <div className="max-w-[1100px] mx-auto px-4 py-8">
        {/* Header (title + subtitle) */}
        <div className="mb-5">
          <Bar w={140} h={20} strong />
          <div className="h-1.5" />
          <Bar w={280} h={13} />
        </div>

        {variant === "overview" ? <OverviewSkeleton /> : <TableSkeleton />}
      </div>
    </main>
  );
}

function OverviewSkeleton(): React.JSX.Element {
  return (
    <>
      {/* 4 cards across */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="border border-hairline border-line rounded-xl p-4 bg-surface min-h-[110px]"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <Bar w={32} h={32} radius={8} />
              <Bar w={90} h={12} />
            </div>
            <Bar w={48} h={24} strong />
            <div className="h-3" />
            <Bar w={70} h={12} />
          </div>
        ))}
      </div>

      {/* Feed card */}
      <div className="border border-hairline border-line rounded-xl pt-[18px] px-[18px] pb-1.5 bg-surface">
        <Bar w={140} h={16} strong />
        <div className="h-3.5" />
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={[
              "flex justify-between items-center py-2.5",
              i === 4 ? "" : "border-b border-hairline border-line",
            ].join(" ")}
          >
            <div>
              <Bar w={90} h={14} />
              <div className="h-1" />
              <Bar w={150} h={12} />
            </div>
            <Bar w={26} h={18} radius={999} />
          </div>
        ))}
      </div>
    </>
  );
}

function TableSkeleton(): React.JSX.Element {
  return (
    <>
      {/* Filter chip row */}
      <div className="flex gap-2 mb-3 items-center">
        <Bar w={48} h={11} />
        <Bar w={120} h={26} radius={8} />
        <Bar w={92} h={26} radius={8} />
        <Bar w={140} h={26} radius={8} />
        <Bar w={130} h={26} radius={8} />
      </div>

      {/* Header card */}
      <div className="bg-surface-2 rounded-lg px-4 py-3.5 mb-4 flex gap-6 items-center">
        <div>
          <Bar w={130} h={11} />
          <div className="h-1.5" />
          <Bar w={40} h={24} strong />
        </div>
        <div className="w-px self-stretch bg-line-2" />
        <div>
          <Bar w={100} h={11} />
          <div className="h-1.5" />
          <Bar w={220} h={16} />
        </div>
      </div>

      {/* Table header + 4 row stripes */}
      <div className="flex justify-between py-2 border-b border-hairline border-line-2">
        {[80, 30, 80, 50, 70, 50, 90].map((w, i) => (
          <Bar key={i} w={w} h={11} />
        ))}
      </div>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className="flex justify-between items-center py-3.5 border-b border-hairline border-line"
        >
          <Bar w={110} h={14} />
          <Bar w={22} h={14} />
          <Bar w={100} h={14} />
          <Bar w={56} h={14} />
          <Bar w={150} h={28} radius={4} />
          <Bar w={64} h={18} radius={999} />
          <Bar w={42} h={14} />
        </div>
      ))}
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
