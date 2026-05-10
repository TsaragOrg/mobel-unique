/*
RU: Этот файл нужен для главной страницы Mobel Unique. Посетитель видит бренд, видео с диваном, путь симуляции и полезные факты. Здесь можно сменить цвет дивана, открыть каталог через основную кнопку или перейти к политике конфиденциальности внизу.
FR: Ce fichier sert a la page d'accueil Mobel Unique. Le visiteur voit la marque, la video du canape, le chemin de simulation et les points utiles. Ici, il peut changer la couleur du canape, ouvrir le catalogue avec le bouton principal ou aller a la page de confidentialite en bas.
*/

import type { Metadata } from "next";
import { HomeHeroVideo } from "./home-hero-video";
import {
  PUBLIC_PRIVACY_POLICY_HREF,
  PUBLIC_PRIVACY_POLICY_LABEL,
} from "./public-legal-links";

// RU: Эти данные задают заголовок вкладки и описание страницы для поиска.
// FR: Ces donnees donnent le titre de l'onglet et le texte court pour la recherche.
export const metadata: Metadata = {
  description:
    "Découvrez les canapés MÖBEL UNIQUE et visualisez-les chez vous avec une simulation assistée par IA.",
  title: "MÖBEL UNIQUE | Simulez nos canapés chez vous",
};

// RU: Эти строки показывают короткий путь от выбора дивана до результата.
// FR: Ces lignes montrent le chemin court du choix du canape au resultat.
const steps = [
  "Choisissez un canapé",
  "Lancez la simulation",
  "Découvrez le rendu chez vous",
];

// RU: Эти данные показывают три причины попробовать симуляцию.
// FR: Ces donnees montrent trois raisons d'essayer la simulation.
const benefits = [
  {
    description: "Visualisez le canapé dans votre pièce en un instant.",
    icon: "lightning",
    title: "Simulation instantanée",
  },
  {
    description: "Proportions et perspectives adaptées à votre intérieur.",
    icon: "sofa",
    title: "Ajustement réaliste",
  },
  {
    description: "Une expérience simple, rapide et précise.",
    icon: "clock",
    title: "Rendu en quelques secondes",
  },
];

export default function Home() {
  return (
    <main className="home-shell">
      {/* RU: Верхняя часть оставляет только бренд, без ссылок справа.
      FR: La partie du haut garde seulement la marque, sans liens a droite. */}
      <header className="home-header" aria-label="Accueil public">
        <a className="home-brand" href="/">
          MÖBEL UNIQUE
        </a>
      </header>

      {/* RU: Главная зона показывает видео, шаги и основную кнопку каталога.
      FR: La zone principale montre la video, les etapes et le bouton du catalogue. */}
      <section
        className="home-hero"
        id="simulation-preview"
        aria-labelledby="page-title"
      >
        <div className="home-hero-media">
          <HomeHeroVideo />
        </div>

        <div className="home-hero-copy" id="process">
          <h1 id="page-title">
            <span>Simulez nos canapés</span>
            <span>chez vous</span>
          </h1>
          <span className="home-title-rule" aria-hidden="true" />
          <p className="home-lede">
            Parcourez notre sélection et visualisez rapidement le modèle dans
            votre intérieur.
          </p>
          <ol className="home-steps">
            {steps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
          <a className="home-primary-cta" href="/catalog">
            <span>Choisir un autre canapé</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      {/* RU: Этот ряд кратко объясняет пользу симуляции.
      FR: Cette ligne explique vite l'interet de la simulation. */}
      <section
        className="home-benefits"
        aria-label="Bénéfices de la simulation"
      >
        {benefits.map((benefit) => (
          <article className="home-benefit" key={benefit.title}>
            <BenefitIcon name={benefit.icon} />
            <div>
              <h2>{benefit.title}</h2>
              <p>{benefit.description}</p>
            </div>
          </article>
        ))}
      </section>

      <p className="home-assurance" id="limits">
        Le rendu généré reste une estimation visuelle. L'achat final reste
        séparé sur Shopify après vérification du modèle, des dimensions et du
        tissu.
      </p>

      {/* RU: Нижняя часть показывает знак сайта, короткое обещание и спокойную ссылку на правила конфиденциальности.
      FR: La partie du bas montre la marque du site, une courte promesse et un lien calme vers les regles de confidentialite. */}
      <footer className="home-footer">
        <span>MÖBEL UNIQUE</span>
        <span>Simulation privée, sélection maîtrisée.</span>
        <a href={PUBLIC_PRIVACY_POLICY_HREF}>
          {PUBLIC_PRIVACY_POLICY_LABEL}
        </a>
      </footer>
    </main>
  );
}

function BenefitIcon({ name }: { name: string }) {
  if (name === "sofa") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="home-benefit-icon">
        <path d="M8 16h16a4 4 0 0 1 4 4v5H4v-5a4 4 0 0 1 4-4Z" />
        <path d="M9 16v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
        <path d="M7 25v3" />
        <path d="M25 25v3" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="home-benefit-icon">
        <circle cx="16" cy="16" r="11" />
        <path d="M16 9v8l5 3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="home-benefit-icon">
      <path d="M17 2 6 18h9l-1 12 12-18h-9l1-10Z" />
    </svg>
  );
}
