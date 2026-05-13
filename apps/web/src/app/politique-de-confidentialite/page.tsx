/*
RU: Этот файл нужен для публичной страницы политики конфиденциальности. Посетитель видит короткие правила о данных, фото комнаты, симуляции, контакте и записи после согласия. Здесь можно понять, зачем нужны данные, сколько хранятся частные изображения и куда написать по вопросам конфиденциальности.
FR: Ce fichier sert a la page publique de confidentialite. Le visiteur voit des regles courtes sur les donnees, la photo de la piece et la simulation. Ici, il peut comprendre pourquoi les donnees sont utiles, combien de temps les images privees restent gardees et ou ecrire pour la confidentialite.
*/

import type { Metadata } from "next";
import { PublicShell } from "../PublicShell";

// RU: Эти данные задают название вкладки и короткое описание для поиска.
// FR: Ces donnees donnent le nom de l'onglet et le texte court pour la recherche.
export const metadata: Metadata = {
  description:
    "Règles de confidentialité de MÖBEL UNIQUE pour les données de navigation et de simulation de canapé à domicile.",
  title: "Politique de confidentialité | MÖBEL UNIQUE",
};

// RU: Эти данные дают короткие блоки текста для страницы, чтобы посетителю было легко читать.
// FR: Ces donnees donnent des blocs courts pour la page, afin que le visiteur lise facilement.
const privacySections = [
  {
    items: [
      "Lors de la navigation, le site utilise des données techniques de base nécessaires au chargement des pages.",
      "MÖBEL UNIQUE n'utilise aucune analyse active.",
      "Il n'y a aucun suivi persistant des interactions avec le catalogue public.",
      "Il n'y a aucun compte client nécessaire pour consulter le site.",
    ],
    title: "Données de navigation",
  },
  {
    items: [
      "Pour une simulation, nous utilisons votre adresse e-mail uniquement pour envoyer le code de vérification.",
      "Cette adresse sert aussi à limiter les abus et les demandes répétées pendant une fenêtre de 24 heures.",
      "Elle n'est pas conservée comme fiche de contact commercial dans le parcours de simulation.",
      "La simulation utilise la photo de votre pièce, une image guide générée et le résultat de simulation généré.",
      "Un accès temporaire dans votre navigateur protège l'ouverture du résultat pendant la durée prévue.",
      "Nous gardons aussi le canapé choisi, le tissu choisi, la position visuelle choisie, le statut du travail, les horodatages, l'état d'échec et les compteurs d'utilisation.",
    ],
    title: "Données de simulation",
  },
  {
    items: [
      "Ces données servent à lancer la visualisation demandée.",
      "Elles servent à afficher le résultat dans votre navigateur.",
      "Elles aident à limiter les abus et les demandes répétées.",
      "Elles permettent de résoudre les problèmes du service MÖBEL UNIQUE.",
      "MÖBEL UNIQUE ne conserve pas l'adresse e-mail de simulation pour vous contacter commercialement.",
    ],
    title: "Pourquoi ces données sont utilisées",
  },
  {
    items: [
      "La vérification par e-mail, la limitation des abus, la photo de pièce, l'image guide et le résultat servent à fournir la visualisation demandée par le visiteur et à protéger l'accès au résultat.",
      "Les données de fonctionnement, de résolution des problèmes et de limitation des abus servent l'intérêt légitime de MÖBEL UNIQUE pour faire fonctionner, sécuriser et améliorer le service MÖBEL UNIQUE.",
    ],
    title: "Base légale",
  },
  {
    items: [
      "Les photos de pièce privées, les images intermédiaires, les images guides et les résultats générés sont supprimés au plus tard 24 heures après leur création.",
      "Les photos de pièce et les résultats générés restent supprimés au plus tard 24 heures après leur création.",
      "Une simulation abandonnée suit la même limite de conservation.",
      "Après suppression, il peut rester de petites données de fonctionnement sans image privée utilisable.",
      "L'accès temporaire dans votre navigateur expire dans la même fenêtre de conservation.",
    ],
    title: "Durée de conservation",
  },
  {
    items: [
      "Les images privées de simulation ne sont pas des éléments du catalogue public.",
      "MÖBEL UNIQUE n'a pas de galerie publique.",
      "MÖBEL UNIQUE n'a pas de lien de partage public.",
      "MÖBEL UNIQUE n'a pas de compte client.",
      "L'accès au résultat généré reste limité à votre session vérifiée pendant la durée de conservation.",
    ],
    title: "Accès et partage",
  },
  {
    items: [
      "Des prestataires techniques de confiance peuvent traiter les données pour héberger le site, garder les fichiers privés, envoyer les e-mails de vérification quand l'envoi réel est en place et produire la visualisation IA demandée.",
      "MÖBEL UNIQUE est le propriétaire du site et le point de contact pour cette expérience.",
      "Cette page ne liste pas les réglages privés, les chemins internes ni les secrets techniques.",
    ],
    title: "Prestataires techniques",
  },
  {
    items: [
      "Vous pouvez demander l'accès, la correction, la suppression, l'opposition, la limitation et la portabilité de vos données.",
      "L'adresse e-mail de simulation n'est pas gardée comme fiche de contact commercial.",
      "Pour une question sur vos données, écrivez au contact confidentialité.",
    ],
    title: "Vos droits",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PublicShell>
      {/* RU: Верхняя часть говорит, что страница посвящена данным посетителя и симуляции.
      FR: La partie du haut dit que la page parle des donnees du visiteur et de la simulation. */}
      <article className="privacy-page" aria-labelledby="privacy-title">
        <header className="privacy-hero">
          <p className="public-eyebrow">Confidentialité</p>
          <h1 id="privacy-title">Politique de confidentialité</h1>
          <p className="privacy-lede">
            MÖBEL UNIQUE vous aide à visualiser un canapé chez vous. Pour
            MÖBEL UNIQUE, vos données personnelles sont utilisées seulement pour cette
            expérience limitée.
          </p>
        </header>

        {/* RU: Этот список показывает все важные правила короткими частями.
        FR: Cette liste montre toutes les regles importantes en parties courtes. */}
        <div className="privacy-section-list">
          {privacySections.map((section) => (
            <section className="privacy-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* RU: Нижняя часть дает простой адрес для вопросов о данных.
        FR: La partie du bas donne une adresse simple pour les questions sur les donnees. */}
        <section className="privacy-contact" aria-labelledby="privacy-contact">
          <h2 id="privacy-contact">Contact confidentialité</h2>
          <p>
            Pour toute demande, écrivez à{" "}
            <a
              className="privacy-contact-link"
              href="mailto:mobel.unique.it@gmail.com"
            >
              mobel.unique.it@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </PublicShell>
  );
}
