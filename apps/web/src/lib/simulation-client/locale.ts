// SPEC-0015 PLAN-0041 visible French copy for the public simulation
// wizard. The wizard renders strings only via this module so that the
// upcoming PLAN-0042 native review can iterate without hunting through
// component files. Strings that carry legal or contractual weight
// (consent confirmation, retention notice, error wording that quotes
// the retention window) are preceded by a `TODO: FR native review`
// marker per the SPEC-0015 Scope section.

export const SIMULATION_LOCALE = {
  contextStrip: {
    separator: " · ",
  },

  screen0EmailGate: {
    eyebrow: "Vérification",
    title: "Vérifiez votre adresse e-mail",
    instructionEmail:
      "Saisissez votre adresse e-mail pour recevoir un code de vérification à usage unique. Ce code ouvre l'accès à la simulation.",
    emailFieldLabel: "Adresse e-mail",
    emailFieldPlaceholder: "vous@exemple.com",
    // TODO: FR native review — consent for simulation email delivery. Confirm legal wording.
    consentEmailUseLabel:
      "J'accepte que MÖBEL UNIQUE utilise mon adresse e-mail pour démarrer ma simulation et m'envoyer le code de vérification. " +
      "Je comprends que ma photo de pièce et les images générées restent privées et sont supprimées automatiquement sous 24 heures.",
    // TODO: FR native review — optional marketing consent. Confirm wording and legal status.
    consentMarketingLabel:
      "J'accepte de recevoir occasionnellement des actualités MÖBEL UNIQUE (facultatif).",
    submitEmailButton: "Recevoir le code",
    instructionCode:
      "Saisissez le code à 6 chiffres que vous venez de recevoir par e-mail.",
    codeFieldLabel: "Code de vérification",
    submitCodeButton: "Vérifier et continuer",
    resendLink: "Renvoyer le code",
    backToEmailLink: "Modifier l'adresse e-mail",
    // TODO: FR native review — error wording shown when the email payload is invalid.
    errorInvalidEmail: "Cette adresse e-mail ne semble pas valide.",
    // TODO: FR native review — error wording shown when consent is missing.
    errorConsentRequired:
      "Vous devez accepter l'utilisation de votre e-mail pour continuer.",
    // TODO: FR native review — error wording for an invalid or expired code.
    errorInvalidCode:
      "Ce code n'est pas valide ou a expiré. Demandez un nouveau code.",
    // TODO: FR native review — generic rate-limited error.
    errorRateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
    // TODO: FR native review — generic verification error fallback.
    errorGeneric:
      "La vérification n'a pas abouti. Réessayez dans quelques instants.",
  },

  screen1PhotoUpload: {
    eyebrow: "Étape 1 sur 3 — Photo de la pièce",
    title: "Photo de votre pièce",
    instructionBackWall:
      "Prenez une photo nette de l'emplacement du canapé en gardant la même direction que l'image du canapé sélectionné.",
    instructionCorner:
      "Placez-vous face au coin où viendra le canapé d'angle. Cadrez les deux murs qui se rejoignent ainsi que le sol jusqu'à vos pieds.",
    guidanceAriaLabel: "Canapé sélectionné et photo de la pièce",
    selectedSofaLabel: "Canapé sélectionné",
    selectedSofaUnavailableTitle: "Aperçu du canapé indisponible",
    selectedSofaUnavailableInstruction:
      "La sélection reste bien prise en compte pour la simulation.",
    roomPhotoTargetLabel: "Photo à prendre",
    roomPhotoTargetActionLabel: "Ajouter une photo de votre pièce",
    replaceRoomPhotoActionLabel: "Remplacer la photo de votre pièce",
    roomPhotoTargetTitle: "Ajouter une photo de votre pièce",
    roomPhotoTargetInstructionDesktop:
      "Cliquez dans ce cadre pour choisir une image.",
    roomPhotoTargetInstructionTouch:
      "Touchez ce cadre pour prendre la photo.",
    orientationGuidancePrefix:
      "Gardez le même angle que la vue sélectionnée :",
    orientationGuidanceSuffix:
      "Si cette vue est de côté, prenez la pièce depuis ce même côté.",
    disclaimerCornerStrong:
      "Le canapé sélectionné est un modèle d'angle. La photo doit montrer un coin de la pièce — deux murs qui se rencontrent — sinon la simulation ne pourra pas se positionner correctement.",
    disclaimerBackWallShort:
      "Cadrez le mur et le sol où viendra le canapé. Si le canapé sélectionné est vu de côté, prenez aussi votre pièce depuis ce côté.",
    previewAlt: "Aperçu de la photo de votre pièce",
    previewUnavailableTitle: "Aperçu indisponible pour ce fichier",
    replaceLink: "Remplacer la photo",
    continueButton: "Continuer",
    photoPreparationLabel: "Préparation de la photo",
    uploadProgressLabel: "Envoi de la photo",
    photoBusyLabel: "Photo en cours de traitement",
    // TODO: FR native review — error wording shown after three upload failures.
    uploadFailedTitle: "L'envoi n'a pas pu aboutir",
    uploadFailedInstruction:
      "Vérifiez votre connexion puis réessayez. Si le problème persiste, choisissez une autre photo.",
    uploadFailedRetryButton: "Réessayer l'envoi",
  },

  screen2RoomPrep: {
    eyebrow: "Préparation",
    title: "Préparation de votre simulation",
    reassurance: "Cela prend environ une minute. Merci de patienter.",
    progressStepLabel: "Étape {current} sur {total}",
    progress: {
      roomValidation: {
        title: "Vérification de votre photo",
        reassurance:
          "Nous vérifions que la pièce est exploitable pour la simulation.",
      },
      roomCleaning: {
        title: "Préparation de votre image",
        reassurance:
          "Nous préparons la photo pour poser les repères correctement.",
      },
      roomCorners: {
        title: "Analyse de la pièce",
        reassurance:
          "Nous détectons les murs, le sol et les repères utiles.",
      },
      dimensionGuide: {
        title: "Préparation du guide de mesures",
        reassurance:
          "Nous préparons l'image guide pour renseigner les dimensions.",
      },
      awaitingDimensions: {
        title: "Guide de mesures prêt",
        reassurance:
          "Les repères sont prêts. Les dimensions de la pièce sont nécessaires pour continuer.",
      },
    },
  },

  screen3Dimensions: {
    eyebrow: "Étape 2 sur 3 — Dimensions",
    title: "Mesurez votre pièce",
    instruction:
      "Renseignez en centimètres les mesures indiquées sur la photo.",
    workspaceAriaLabel: "Photo guide et dimensions à renseigner",
    formEyebrow: "Mesures à fournir",
    guideImageAlt:
      "Aperçu de votre pièce avec des lignes colorées indiquant les dimensions à renseigner",
    guideImageUnavailable: "Aperçu temporairement indisponible.",
    fieldUnitSuffix: "cm",
    fields: {
      backWall: {
        wallWidth: "Largeur du mur (rouge)",
        wallHeight: "Hauteur du mur (bleu)",
        roomDepth: "Profondeur de la pièce (vert)",
      },
      corner: {
        leftWallWidth: "Mur gauche (rouge)",
        rightWallWidth: "Mur droit (rouge)",
        roomHeight: "Hauteur de la pièce (bleu)",
        roomDepth: "Profondeur de la pièce (vert)",
      },
    },
    validationOutOfRange:
      "Chaque dimension doit être comprise entre 50 et 2000 cm.",
    continueButton: "Continuer",
  },

  screen4Placement: {
    eyebrow: "Visualisation",
    titleInitial: "Mise en place de votre canapé",
    titleRegeneration: "Nouvelle génération en cours",
    reassuranceInitial: "Cela prend environ une minute. Merci de patienter.",
    reassuranceRegeneration: "Patientez quelques instants.",
    progressStepLabel: "Étape {current} sur {total}",
    progress: {
      placementGeneration: {
        title: "Placement du canapé dans votre pièce",
        reassurance:
          "Nous alignons le canapé sélectionné avec la photo de votre pièce.",
      },
    },
  },

  screen5Result: {
    eyebrow: "Étape 3 sur 3 — Résultat",
    title: "Votre canapé dans votre pièce",
    panelLabel: "Résultat",
    resultImageAlt: "Aperçu de votre canapé placé dans votre pièce",
    generationCountLabel: "Génération {current} sur {total}",
    regenerateButton: "Lancer une nouvelle génération",
    regeneratingButton: "Nouvelle génération en cours",
    downloadButton: "Télécharger l'image",
    downloadingButton: "Téléchargement en cours",
    downloadFailedNotice:
      "Le téléchargement n'a pas abouti. Réessayez dans quelques instants.",
    regenerationLimitNotice: "Limite de générations atteinte.",
    backToSofaLink: "Retour au canapé",
    // TODO: FR native review — retention notice quotes the 24h window.
    retentionNotice:
      "Cette image sera supprimée automatiquement dans 24 heures.",
    // TODO: FR native review — inline error after a failed regeneration.
    regenerationFailedNotice:
      "La nouvelle génération n'a pas abouti. Le résultat précédent reste affiché.",
  },

  screen6ErrorOrExpired: {
    error: {
      eyebrow: "Une erreur est survenue",
      title: "Nous n'avons pas pu finaliser votre simulation",
      // TODO: FR native review — generic instruction shown for any failure.
      instruction:
        "Veuillez réessayer avec une autre photo. Si le problème persiste, revenez plus tard.",
      diagnosticPrefix: "Diagnostic",
      heicDiagnostic:
        "Le fichier HEIC/HEIF n'a pas pu être converti. Réessayez avec une photo JPEG ou désactivez le mode Haute efficacité de l'appareil photo.",
      genericDiagnostic:
        "Le traitement côté serveur a échoué après l'envoi de la photo.",
      restartButton: "Recommencer la simulation",
      backToSofaLink: "Retour au canapé",
    },
    expired: {
      eyebrow: "Simulation expirée",
      title: "Cette simulation n'est plus disponible",
      // TODO: FR native review — expiration notice quotes the 24h window.
      notice: "Les images sont automatiquement supprimées après 24 heures.",
      backToCatalogLink: "Retour au catalogue",
    },
  },

  shared: {
    backLinkLabel: "Retour",
  },
} as const;

export type SimulationLocale = typeof SIMULATION_LOCALE;
