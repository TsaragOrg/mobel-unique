import Link from "next/link";
import type { ReactNode } from "react";

const ADMIN_NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
  },
  {
    href: "/admin/sofas",
    label: "Sofas",
  },
  {
    href: "/admin/fabrics",
    label: "Fabrics",
  },
  {
    href: "/admin/tags",
    label: "Tags",
  },
] as const;

type AdminShellProps = {
  children: ReactNode;
  showNavigation?: boolean;
  variant?: "auth" | "workspace";
};

type AdminPageHeaderProps = {
  actions?: ReactNode;
  description?: string;
  eyebrow: string;
  title: string;
  titleId: string;
};

export function AdminShell({
  children,
  showNavigation = true,
  variant = "workspace",
}: AdminShellProps) {
  return (
    <main className={`admin-app admin-app-${variant}`}>
      <div className="admin-frame">
        <header className="admin-topbar">
          <Link className="admin-brand" href={showNavigation ? "/admin" : "/"}>
            MOBEL UNIQUE
          </Link>
          {showNavigation ? <AdminNavigation /> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

export function AdminNavigation() {
  return (
    <nav className="admin-nav" aria-label="Admin">
      {ADMIN_NAV_ITEMS.map((item) => (
        <Link href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminPageHeader({
  actions,
  description,
  eyebrow,
  title,
  titleId,
}: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        {description ? (
          <p className="admin-page-description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}
