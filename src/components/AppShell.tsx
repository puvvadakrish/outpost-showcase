import Link from "next/link";
import type { ReactNode } from "react";
import type { MembershipRole } from "@/domain/models";

type NavItemId = "overview" | "tasks" | "owner" | "locations" | "admin";

const navItems: Array<{ group: string; href: string; id: NavItemId; label: string }> = [
  { id: "overview", href: "/", label: "Overview", group: "Work" },
  { id: "tasks", href: "/staff/tasks", label: "Front-desk workboard", group: "Work" },
  { id: "owner", href: "/owner", label: "Owner setup", group: "Setup" },
  { id: "locations", href: "/owner/locations", label: "Locations", group: "Setup" },
  { id: "admin", href: "/admin", label: "Admin portal", group: "Internal ops" }
];

export interface AppShellAccount {
  email: string;
  name: string;
  role: MembershipRole;
  signOutAction?: () => Promise<void>;
}

export interface TopbarMetric {
  attention?: boolean;
  label: string;
  value: number | string;
}

interface AppShellProps {
  account?: AppShellAccount;
  activeNav?: string;
  children: ReactNode;
  metrics?: TopbarMetric[];
  milestoneLabel?: string;
  tenantName: string;
  subtitle: string;
}

function OutpostMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" focusable="false">
      <rect className="mark-shell" x="5" y="5" width="38" height="38" rx="13" />
      <rect className="mark-rail" x="13" y="10" width="4" height="28" rx="2" />
      <rect className="mark-board" x="21" y="12" width="18" height="24" rx="6" />
      <circle className="mark-dot mark-dot-mint" cx="27" cy="19" r="3.5" />
      <circle className="mark-dot mark-dot-amber" cx="27" cy="30" r="3.5" />
      <rect className="mark-line mark-line-top" x="31" y="18" width="5.5" height="2.2" rx="1.1" />
      <rect className="mark-line" x="31" y="29" width="5.5" height="2.2" rx="1.1" />
    </svg>
  );
}

function NavGlyph({ id }: { id: NavItemId }) {
  switch (id) {
    case "overview":
      return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <rect x="5" y="6" width="5" height="12" rx="2" />
          <rect x="14" y="4" width="5" height="14" rx="2" />
        </svg>
      );
    case "tasks":
      return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="M6 7h12" />
          <path d="M6 12h12" />
          <path d="M6 17h8" />
          <circle cx="4" cy="7" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="17" r="1" />
        </svg>
      );
    case "owner":
      return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="M12 4l7 3v5c0 4-2.7 6.7-7 8-4.3-1.3-7-4-7-8V7l7-3z" />
          <path d="M9 12l2 2 4-5" />
        </svg>
      );
    case "locations":
      return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="M6 20V8l6-4 6 4v12" />
          <path d="M9 20v-6h6v6" />
          <path d="M10 9h4" />
        </svg>
      );
    case "admin":
      return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v3" />
          <path d="M12 17v3" />
          <path d="M4 12h3" />
          <path d="M17 12h3" />
        </svg>
      );
  }
}

function accountInitials(name: string) {
  const words = name
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "O";
  }

  const initialWords = words.length === 1 ? words : [words[0], words[words.length - 1]];

  return initialWords
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function roleLabel(role: MembershipRole) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "staff") {
    return "Staff";
  }

  return "Admin";
}

export function AppShell({
  account,
  activeNav,
  children,
  metrics = [],
  milestoneLabel,
  tenantName,
  subtitle
}: AppShellProps) {
  const groups = ["Work", "Setup", "Internal ops"];
  const accountName = account?.name ?? tenantName;
  const initials = accountInitials(accountName);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <OutpostMark />
          </span>
          <span className="brand-copy">
            <strong>Outpost</strong>
            <span>Gym front-desk automation</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-title">{group}</div>
              <div className="nav-list">
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <Link
                      aria-current={activeNav === item.id ? "page" : undefined}
                      className={`nav-link${activeNav === item.id ? " nav-link-active" : ""}`}
                      href={item.href}
                      key={item.href}
                    >
                      <span className="nav-icon">
                        <NavGlyph id={item.id} />
                      </span>
                      <span className="nav-label">{item.label}</span>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="account-avatar">{initials}</span>
          <span className="account-copy">
            <strong>{accountName}</strong>
            <span>{account ? `${roleLabel(account.role)} account` : subtitle}</span>
            {account?.email ? <span className="account-email">{account.email}</span> : null}
          </span>
          {account?.signOutAction ? (
            <form action={account.signOutAction} className="account-sign-out-form">
              <button className="account-sign-out" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-title">
            <strong>{tenantName}</strong>
            <span>{subtitle}</span>
          </div>
          {metrics.length > 0 ? (
            <div className="topbar-metrics">
              {metrics.map((metric) => (
                <div
                  className={`topbar-metric${metric.attention ? " attention" : ""}`}
                  key={metric.label}
                >
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div />
          )}
          <div className="topbar-context">
            <span className="channel-pill">Phone + email v1</span>
            {milestoneLabel ? <span className="muted">{milestoneLabel}</span> : null}
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
