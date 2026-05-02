import type { ReactNode } from "react";

interface PublicShellProps {
  children: ReactNode;
  currentPath?: "catalog" | "detail" | "home";
}

export function PublicShell({ children, currentPath }: PublicShellProps) {
  return (
    <main className="public-shell">
      <header className="public-header" aria-label="Navigation publique">
        <a className="public-brand" href="/">
          MÖBEL UNIQUE
        </a>
        <nav className="public-header-nav" aria-label="Navigation publique">
          <a
            aria-current={currentPath === "catalog" ? "page" : undefined}
            href="/catalog"
          >
            Catalogue
          </a>
        </nav>
      </header>
      {children}
      <footer className="public-footer">
        <span>MÖBEL UNIQUE</span>
        <span>Simulation privée, sélection maîtrisée.</span>
      </footer>
    </main>
  );
}
