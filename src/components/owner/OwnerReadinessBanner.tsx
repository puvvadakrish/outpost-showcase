import Link from "next/link";

interface LaunchBlocker {
  href: string;
  label: string;
}

interface OwnerReadinessBannerProps {
  blockers: LaunchBlocker[];
}

export function OwnerReadinessBanner({ blockers }: OwnerReadinessBannerProps) {
  return (
    <section className="readiness-banner section-gap" aria-label="Launch readiness">
      <div>
        <span className="rail-title">Readiness gate</span>
        <strong>Live phone and email remain blocked</strong>
        <p>
          Owner setup stages approvals and configuration only. Live calls,
          email automation, provider config, and test traffic remain disconnected.
        </p>
      </div>
      <div className="readiness-banner-list">
        {blockers.map((blocker) => (
          <Link href={blocker.href} key={`${blocker.href}-${blocker.label}`}>
            {blocker.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
