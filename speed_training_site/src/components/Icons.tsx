// Hand-drawn icon set for the binder world: one stroke weight, round caps.
type P = { className?: string; title?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function IconArrow({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconDown({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

export function IconPlay({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  );
}

export function IconPlus({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconExternal({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function IconMail({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </svg>
  );
}

export function IconUser({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function IconGroup({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M3 19a6 6 0 0 1 12 0M15 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  );
}

export function IconStar({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" />
    </svg>
  );
}

export function IconCheckSmall({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
