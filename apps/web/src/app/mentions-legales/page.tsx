/*
RU: Этот файл нужен для публичной страницы юридических сведений. Посетитель видит данные компании, ответственного человека, хостинг, права на материалы и ссылку о данных. Здесь можно узнать, кто отвечает за сайт, как связаться с компанией и где читать правила конфиденциальности.
FR: Ce fichier sert a la page publique des mentions legales. Le visiteur voit les donnees de la societe, la personne responsable, l'hebergement, les droits sur les contenus et le lien sur les donnees. Ici, il peut savoir qui gere le site, comment contacter la societe et ou lire les regles de confidentialite.
*/

import type { Metadata } from "next";
import { PublicShell } from "../PublicShell";
import {
  PUBLIC_PRIVACY_POLICY_HREF,
  PUBLIC_PRIVACY_POLICY_LABEL,
} from "../public-legal-links";

// RU: Эти данные задают название вкладки и короткое описание для поиска.
// FR: Ces donnees donnent le nom de l'onglet et le texte court pour la recherche.
export const metadata: Metadata = {
  description:
    "Informations legales de MOBEL UNIQUE pour identifier l'editeur du site et son hebergeur.",
  title: "Mentions legales | MOBEL UNIQUE",
};

// RU: Эти данные дают короткие разделы, чтобы страницу было легко читать.
// FR: Ces donnees donnent des parties courtes pour faciliter la lecture.
const legalSections = [
  {
    items: [
      "Raison sociale : SARL MOBILIER & ART.",
      "Nom commercial public : MOBEL UNIQUE.",
      "Forme juridique : SARL.",
      "Adresse du siege social : 8 Rue Danielle Casanova, 95100 Argenteuil, France.",
      "Capital social : 1000 euros.",
      "Immatriculation : RCS Pontoise 943 675 579.",
      "SIREN : 943 675 579.",
    ],
    title: "Editeur du site",
  },
  {
    items: ["Directeur de la publication : Abdul Dzhabrailov."],
    title: "Directeur de la publication",
  },
  {
    items: [
      "Hebergeur : Vercel Inc.",
      "Adresse : 440 N Barranca Avenue #4133, Covina, CA 91723, United States.",
    ],
    title: "Hebergement",
  },
  {
    items: [
      "Les textes, visuels, marques, elements du catalogue et presentations publiques du site appartiennent a MOBEL UNIQUE ou sont utilises avec autorisation.",
    ],
    title: "Propriete intellectuelle",
  },
];

export default function LegalNoticePage() {
  return (
    <PublicShell>
      {/* RU: Верхняя часть говорит, что страница нужна для юридической идентификации сайта.
      FR: La partie du haut dit que la page sert a identifier le site. */}
      <article className="legal-page" aria-labelledby="legal-title">
        <header className="legal-hero">
          <p className="public-eyebrow">Informations legales</p>
          <h1 id="legal-title">Mentions legales</h1>
          <p className="legal-lede">
            Cette page identifie l'editeur du site MOBEL UNIQUE et son
            hebergeur.
          </p>
        </header>

        {/* RU: Этот список показывает основные юридические сведения короткими частями.
        FR: Cette liste montre les informations legales principales en parties courtes. */}
        <div className="legal-section-list">
          {legalSections.map((section) => (
            <section className="legal-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* RU: Эта часть дает простые способы связи с компанией и хостингом.
        FR: Cette partie donne des moyens simples de contacter la societe et l'hebergeur. */}
        <section className="legal-section" aria-labelledby="legal-contact">
          <h2 id="legal-contact">Contacts</h2>
          <ul>
            <li>
              E-mail public :{" "}
              <a
                className="legal-contact-link"
                href="mailto:aide.mobelunique@gmail.com"
              >
                aide.mobelunique@gmail.com
              </a>
              .
            </li>
            <li>
              Telephone public :{" "}
              <a className="legal-contact-link" href="tel:+33658936106">
                +33 6 58 93 61 06
              </a>
              .
            </li>
            <li>
              Contact hebergeur :{" "}
              <a
                className="legal-contact-link"
                href="https://vercel.com/contact"
              >
                https://vercel.com/contact
              </a>
              .
            </li>
          </ul>
        </section>

        {/* RU: Нижняя часть направляет посетителя к отдельной странице о данных.
        FR: La partie du bas envoie le visiteur vers la page separee sur les donnees. */}
        <section className="legal-section" aria-labelledby="legal-personal-data">
          <h2 id="legal-personal-data">Donnees personnelles</h2>
          <ul>
            <li>
              Le traitement des donnees personnelles est explique sur une page
              separee. Lire la{" "}
              <a
                className="legal-contact-link"
                href={PUBLIC_PRIVACY_POLICY_HREF}
              >
                {PUBLIC_PRIVACY_POLICY_LABEL}
              </a>
              .
            </li>
          </ul>
        </section>
      </article>
    </PublicShell>
  );
}
