import Link from "next/link";

type Props = {
  states: string[];
  // Set only for captives — produces the " · vs competitors of {brand}" suffix
  // (spec §Navigation). Independent pages pass undefined; the page already
  // shows all relevant brands so the suffix would be noise.
  captiveBrand?: string;
};

const C = {
  surface2: "#F4F2EC",
  text2: "#5F5E5A",
  blueText: "#0C447C",
};

export default function ScopeStrip({
  states,
  captiveBrand,
}: Props): React.JSX.Element {
  const stateList = states.join(", ");
  const suffix = captiveBrand ? ` · vs competitors of ${captiveBrand}` : "";

  return (
    <div
      data-testid="scope-strip"
      style={{
        background: C.surface2,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 12,
      }}
    >
      <span style={{ color: C.text2 }} data-testid="scope-label">
        <i
          className="ti ti-filter"
          style={{ fontSize: 13, verticalAlign: -2, marginRight: 6 }}
          aria-hidden
        />
        Showing: {stateList}
        {suffix}
      </span>
      <Link
        href="/setup"
        data-testid="scope-edit"
        style={{
          color: C.blueText,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Edit
      </Link>
    </div>
  );
}
