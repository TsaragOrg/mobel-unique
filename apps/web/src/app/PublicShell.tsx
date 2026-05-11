/*
RU: Этот файл задает общую рамку публичных страниц. Посетитель видит знак MOBEL UNIQUE сверху, содержимое выбранной страницы и нижнюю строку сайта. Здесь можно нажать на знак MOBEL UNIQUE для перехода на главную или открыть нижние правовые страницы.
FR: Ce fichier donne le cadre commun des pages publiques. Le visiteur voit la marque MOBEL UNIQUE en haut, le contenu de la page choisie et la ligne du bas du site. Ici, on peut appuyer sur la marque MOBEL UNIQUE pour aller a la page d'accueil ou ouvrir les pages legales en bas.
*/

import type { ReactNode } from "react";
import { PUBLIC_LEGAL_LINKS } from "./public-legal-links";

interface PublicShellProps {
  children: ReactNode;
  currentPath?: "catalog" | "detail" | "home";
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <main className="public-shell">
      {/* RU: Эта верхняя часть показывает только знак сайта без лишней ссылки каталога. */}
      {/* FR: Cette partie du haut montre seulement la marque du site, sans lien catalogue en plus. */}
      <header className="public-header" aria-label="Navigation publique">
        <a className="public-brand" href="/">
          MÖBEL UNIQUE
        </a>
      </header>
      {children}
      {/* RU: Эта нижняя часть показывает название сайта, короткое сообщение и тихие правовые ссылки. */}
      {/* FR: Cette partie du bas montre le nom du site, un court message et des liens legaux discrets. */}
      <footer className="public-footer">
        <span>MÖBEL UNIQUE</span>
        <span>Simulation privée, sélection maîtrisée.</span>
        <nav className="public-footer-legal-links" aria-label="Liens legaux">
          {PUBLIC_LEGAL_LINKS.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </footer>
    </main>
  );
}
