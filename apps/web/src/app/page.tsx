import type { Metadata } from "next";
import { HomeHeroVideo } from "./home-hero-video";

export const metadata: Metadata = {
  description:
    "Choisis un canapé MÖBEL UNIQUE et projette-le chez toi avec une simulation assistée par IA.",
  title: "MÖBEL UNIQUE | Simulation de canapé à domicile",
};

const steps = [
  "Choisis ton canapé",
  "Sélectionne un tissu et une vue",
  "Ajoute une photo de ton salon",
  "Découvre une visualisation générée par IA",
];

export default function Home() {
  return (
    <main className="home-shell">
      <header className="home-header" aria-label="Accueil public">
        <a className="home-brand" href="/">
          MÖBEL UNIQUE
        </a>
        <a className="home-header-link" href="/catalog">
          Choisir un canapé
        </a>
      </header>

      <section className="home-hero" aria-labelledby="page-title">
        <div className="home-hero-copy">
          <p className="home-kicker">Visualisation IA à domicile</p>
          <h1 id="page-title">
            In-home simulation, in-home sofa simulation with AI
          </h1>
          <p className="home-lede">
            Sélectionne un canapé MÖBEL UNIQUE, ajoute une photo de ton salon et
            découvre une projection visuelle avant de finaliser ton achat.
          </p>
          <p className="home-shopify-note">
            La commande finale se fait sur Shopify après ta vérification du
            modèle, des dimensions et du tissu.
          </p>
        </div>

        <div className="home-hero-media">
          <div
            className="home-phone-frame"
            data-orientation="landscape"
            aria-label="Aperçu dans un iPhone en mode paysage"
          >
            <HomeHeroVideo />
          </div>
          <a className="home-primary-cta" href="/catalog">
            Choisir un canapé pour simuler chez toi
          </a>
        </div>
      </section>

      <section className="home-process" aria-labelledby="process-title">
        <div className="home-section-heading">
          <p className="home-kicker">Parcours simple</p>
          <h2 id="process-title">De la sélection à la projection chez toi</h2>
        </div>
        <ol className="home-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="home-note" aria-labelledby="ai-note-title">
        <h2 id="ai-note-title">À garder en tête</h2>
        <p>
          La visualisation générée par IA est une estimation destinée à t’aider
          à te projeter. Les mesures, les proportions et le rendu du tissu
          doivent être vérifiés avant la commande finale.
        </p>
      </section>

      <footer className="home-footer">
        <span>MÖBEL UNIQUE</span>
        <span>Simulation privée, sélection maîtrisée, achat final sur Shopify.</span>
      </footer>
    </main>
  );
}
