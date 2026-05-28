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

const C = {
  bg: "#fafaf9",
  surface: "#ffffff",
  surface2: "#F4F2EC",
  skeleton: "#E8E6E0",        // low-contrast fill
  skeletonStrong: "#DCD9D2",  // slightly darker for headings
  line: "rgba(0,0,0,0.08)",
  line2: "rgba(0,0,0,0.15)",
};

type Props = { variant: "overview" | "table" };

export default function PageSkeleton({ variant }: Props): React.JSX.Element {
  return (
    <main
      data-testid="page-skeleton"
      data-variant={variant}
      className="min-h-screen"
      style={{ background: C.bg }}
      aria-busy="true"
      aria-live="polite"
    >
      {/* Scope strip placeholder — only the table variant has one */}
      {variant === "table" && (
        <div
          style={{
            background: C.surface2,
            padding: "8px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Bar w={180} h={14} />
          <Bar w={30} h={14} />
        </div>
      )}

      <div className="max-w-[1100px] mx-auto px-4 py-8">
        {/* Header (title + subtitle) */}
        <div className="mb-5">
          <Bar w={140} h={20} strong />
          <div style={{ height: 6 }} />
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              border: `0.5px solid ${C.line}`,
              borderRadius: 12,
              padding: 16,
              background: C.surface,
              minHeight: 110,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Bar w={32} h={32} radius={8} />
              <Bar w={90} h={12} />
            </div>
            <Bar w={48} h={24} strong />
            <div style={{ height: 12 }} />
            <Bar w={70} h={12} />
          </div>
        ))}
      </div>

      {/* Feed card */}
      <div
        style={{
          border: `0.5px solid ${C.line}`,
          borderRadius: 12,
          padding: "18px 18px 6px",
          background: C.surface,
        }}
      >
        <Bar w={140} h={16} strong />
        <div style={{ height: 14 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: i === 4 ? "none" : `0.5px solid ${C.line}`,
            }}
          >
            <div>
              <Bar w={90} h={14} />
              <div style={{ height: 4 }} />
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
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <Bar w={48} h={11} />
        <Bar w={120} h={26} radius={8} />
        <Bar w={92} h={26} radius={8} />
        <Bar w={140} h={26} radius={8} />
        <Bar w={130} h={26} radius={8} />
      </div>

      {/* Header card */}
      <div
        style={{
          background: C.surface2,
          borderRadius: 8,
          padding: "14px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <Bar w={130} h={11} />
          <div style={{ height: 6 }} />
          <Bar w={40} h={24} strong />
        </div>
        <div style={{ width: "0.5px", background: C.line2, alignSelf: "stretch" }} />
        <div>
          <Bar w={100} h={11} />
          <div style={{ height: 6 }} />
          <Bar w={220} h={16} />
        </div>
      </div>

      {/* Table header + 4 row stripes */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `0.5px solid ${C.line2}` }}>
        {[80, 30, 80, 50, 70, 50, 90].map((w, i) => (
          <Bar key={i} w={w} h={11} />
        ))}
      </div>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 0",
            borderBottom: `0.5px solid ${C.line}`,
          }}
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
      style={{
        width: w,
        height: h,
        background: strong ? C.skeletonStrong : C.skeleton,
        borderRadius: radius ?? 4,
      }}
    />
  );
}
