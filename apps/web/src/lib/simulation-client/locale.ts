// SPEC-0015 PLAN-0041 visible French copy for the public simulation
// wizard. The wizard renders strings only via this module so that the
// upcoming PLAN-0042 native review can iterate without hunting through
// component files. Strings that carry legal or contractual weight
// (consent confirmation, retention notice, error wording that quotes
// the retention window) are preceded by a `TODO: FR native review`
// marker per the SPEC-0015 Scope section.

export const SIMULATION_LOCALE = {
  contextStrip: {
    separator: " · "
  },

  screen1PhotoUpload: {
    eyebrow: "Étape 1 sur 3 — Photo de la pièce",
    title: "Photo de votre pièce",
    instructionBackWall:
      "Placez-vous face au mur où viendra le canapé et prenez une photo nette en cadrant le mur en entier, du sol au plafond.",
    instructionCorner:
      "Placez-vous face au coin où viendra le canapé d'angle. Cadrez les deux murs qui se rejoignent ainsi que le sol jusqu'à vos pieds.",
    disclaimerCornerStrong:
      "Le canapé sélectionné est un modèle d'angle. La photo doit montrer un coin de la pièce — deux murs qui se rencontrent — sinon la simulation ne pourra pas se positionner correctement.",
    disclaimerBackWallShort:
      "Une seule prise de vue frontale d'un mur suffit. Évitez les photos prises en biais.",
    takePhotoButton: "Prendre une photo",
    chooseFileButton: "Choisir un fichier",
    previewAlt: "Aperçu de la photo de votre pièce",
    replaceLink: "Remplacer la photo",
    continueButton: "Continuer",
    uploadProgressLabel: "Envoi de la photo",
    // TODO: FR native review — error wording shown after three upload failures.
    uploadFailedTitle: "L'envoi n'a pas pu aboutir",
    uploadFailedInstruction:
      "Vérifiez votre connexion puis réessayez. Si le problème persiste, choisissez une autre photo.",
    uploadFailedRetryButton: "Réessayer l'envoi"
  },

  screen2RoomPrep: {
    eyebrow: "Préparation",
    title: "Préparation de votre simulation",
    reassurance: "Cela prend environ une minute. Merci de patienter."
  },

  screen3Dimensions: {
    eyebrow: "Étape 2 sur 3 — Dimensions",
    title: "Mesurez votre pièce",
    instruction:
      "Indiquez les dimensions de votre pièce en mètres, en suivant les lignes colorées affichées sur l'image.",
    guideImageAlt:
      "Aperçu de votre pièce avec des lignes colorées indiquant les dimensions à renseigner",
    guideImageUnavailable: "Aperçu temporairement indisponible.",
    fieldUnitSuffix: "m",
    fields: {
      backWall: {
        wallWidth: "Largeur du mur (rouge)",
        wallHeight: "Hauteur du mur (bleu)",
        roomDepth: "Profondeur de la pièce (vert)"
      },
      corner: {
        leftWallWidth: "Mur gauche (rouge)",
        rightWallWidth: "Mur droit (rouge)",
        roomHeight: "Hauteur de la pièce (bleu)",
        roomDepth: "Profondeur de la pièce (vert)"
      }
    },
    validationOutOfRange:
      "Chaque dimension doit être un nombre positif inférieur à 20 mètres.",
    continueButton: "Continuer"
  },

  screen4Placement: {
    eyebrow: "Visualisation",
    titleInitial: "Mise en place de votre canapé",
    titleRegeneration: "Nouvelle génération en cours",
    reassuranceInitial: "Cela prend environ une minute. Merci de patienter.",
    reassuranceRegeneration: "Patientez quelques instants."
  },

  screen5Result: {
    eyebrow: "Étape 3 sur 3 — Résultat",
    title: "Votre canapé dans votre pièce",
    resultImageAlt: "Aperçu de votre canapé placé dans votre pièce",
    regenerateButton: "Lancer une nouvelle génération",
    backToSofaLink: "Retour au canapé",
    // TODO: FR native review — retention notice quotes the 24h window.
    retentionNotice: "Cette image sera supprimée automatiquement dans 24 heures.",
    // TODO: FR native review — inline error after a failed regeneration.
    regenerationFailedNotice:
      "La nouvelle génération n'a pas abouti. Le résultat précédent reste affiché."
  },

  screen6ErrorOrExpired: {
    error: {
      eyebrow: "Une erreur est survenue",
      title: "Nous n'avons pas pu finaliser votre simulation",
      // TODO: FR native review — generic instruction shown for any failure.
      instruction:
        "Veuillez réessayer avec une autre photo. Si le problème persiste, revenez plus tard.",
      restartButton: "Recommencer la simulation",
      backToSofaLink: "Retour au canapé"
    },
    expired: {
      eyebrow: "Simulation expirée",
      title: "Cette simulation n'est plus disponible",
      // TODO: FR native review — expiration notice quotes the 24h window.
      notice: "Les images sont automatiquement supprimées après 24 heures.",
      backToCatalogLink: "Retour au catalogue"
    }
  },

  shared: {
    backLinkLabel: "Retour"
  }
} as const;

export type SimulationLocale = typeof SIMULATION_LOCALE;
