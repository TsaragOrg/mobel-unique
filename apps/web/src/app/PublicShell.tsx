/*
RU: Этот файл задает общую рамку публичных страниц.
RU: На экране посетитель видит знак MOBEL UNIQUE сверху, содержимое выбранной страницы и нижнюю строку сайта.
RU: Здесь можно нажать на знак MOBEL UNIQUE, чтобы перейти на главную страницу.
FR: Ce fichier donne le cadre commun des pages publiques.
FR: A l'ecran, le visiteur voit la marque MOBEL UNIQUE en haut, le contenu de la page choisie et la ligne du bas du site.
FR: Ici, on peut appuyer sur la marque MOBEL UNIQUE pour aller a la page d'accueil.
*/

import type { ReactNode } from "react";

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
      {/* RU: Эта нижняя часть показывает название сайта и короткое сообщение. */}
      {/* FR: Cette partie du bas montre le nom du site et un court message. */}
      <footer className="public-footer">
        <span>MÖBEL UNIQUE</span>
        <span>Simulation privée, sélection maîtrisée.</span>
      </footer>
    </main>
  );
}
