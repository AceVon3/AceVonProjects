import Link from "next/link";

type Props = {
  states: string[];
  // Set only for captives — produces the " · vs competitors of {brand}" suffix
  // (spec §Navigation). Independent pages pass undefined; the page already
  // shows all relevant brands so the suffix would be noise.
  captiveBrand?: string;
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
      className="bg-surface-2 px-4 py-2 flex items-center justify-between text-12"
    >
      <span className="text-ink-2" data-testid="scope-label">
        <i
          className="ti ti-filter text-13 mr-1.5 align-[-2px]"
          aria-hidden
        />
        Showing: {stateList}
        {suffix}
      </span>
      <Link
        href="/setup"
        data-testid="scope-edit"
        className="text-blue-text font-medium no-underline"
      >
        Edit
      </Link>
    </div>
  );
}
