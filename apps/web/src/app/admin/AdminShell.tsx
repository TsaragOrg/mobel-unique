/*
RU: Этот файл нужен для общей рамки админки. На экране видно логотип, навигацию и заголовки страниц. Здесь можно перейти между разделами или увидеть заголовок текущей страницы.
FR: Ce fichier sert au cadre commun de l'admin. A l'ecran, on voit le logo, la navigation et les titres des pages. Ici, on peut passer entre les zones ou lire le titre de la page.
*/

import Link from "next/link";
import type { ReactNode } from "react";
import { ADMIN_COPY } from "./admin-copy";

// RU: Эти ссылки показывают верхнее меню админки.
// FR: Ces liens affichent le menu du haut de l'admin.
const ADMIN_NAV_ITEMS = [
  {
    href: "/admin",
    label: ADMIN_COPY.shell.navigation.dashboard,
  },
  {
    href: "/admin/sofas",
    label: ADMIN_COPY.shell.navigation.sofas,
  },
  {
    href: "/admin/fabrics",
    label: ADMIN_COPY.shell.navigation.fabrics,
  },
  {
    href: "/admin/tags",
    label: ADMIN_COPY.shell.navigation.tags,
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
            {ADMIN_COPY.shell.brand}
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
    <nav className="admin-nav" aria-label={ADMIN_COPY.shell.navigationAriaLabel}>
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
