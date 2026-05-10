export const ADMIN_LOCALE = "fr-FR";

export type AdminUploadPreparationMessageInput =
  | {
      kind: "fabric_swatch_crop";
    }
  | {
      convertedWebp: boolean;
      height: number;
      kind: "render_input";
      resized: boolean;
      targetHeight: number;
      targetWidth: number;
      width: number;
    };

export const ADMIN_COPY = {
  auth: {
    checkingSession: "Vérification de la session admin.",
    deniedDescription:
      "Ce compte n'est pas autorisé à ouvrir l'espace admin.",
    deniedEyebrow: "Espace sécurisé",
    deniedTitle: "Accès admin indisponible",
    returnToSignIn: "Retour à la connexion",
  },
  catalog: {
    actions: {
      addColumn: "Ajouter une colonne",
      addOptionalNote: "Ajouter une note",
      archiveFabric: "Archiver le tissu",
      archiveSofa: "Archiver le canapé",
      assignFabric: "Associer le tissu",
      cancel: "Annuler",
      cancelDelete: "Annuler la suppression",
      cancelRefine: "Annuler l'amélioration",
      closeComparison: "Fermer la comparaison",
      closeCurrentRender: "Fermer le rendu actuel",
      closeLargeImage: "Fermer la grande image",
      closeRenderCell: "Fermer la cellule de rendu",
      closeViewColumnsDialog: "Fermer la fenêtre des colonnes",
      confirmArchive: "Confirmer l'archivage",
      create: "Créer",
      createDraft: "Créer le brouillon",
      createFabric: "Créer le tissu",
      createTag: "Créer l'étiquette",
      createZipExport: "Créer l'export ZIP",
      delete: "Supprimer",
      downloadZipExport: "Télécharger l'export ZIP",
      edit: "Modifier",
      generateMissing: "Générer les rendus manquants",
      generateNewCandidate: "Générer une nouvelle variante",
      hideOptionalNote: "Masquer la note",
      newFabric: "Nouveau tissu",
      newSofa: "Nouveau canapé",
      openDetails: "Ouvrir le détail",
      publishSofa: "Publier le canapé",
      refine: "Améliorer",
      refineCandidate: "Améliorer la variante",
      resetOrder: "Réinitialiser l'ordre",
      restoreFromArchive: "Restaurer depuis l'archive",
      reviewCandidates: "Voir les variantes",
      save: "Enregistrer",
      saveCrop: "Enregistrer le recadrage",
      saveFabric: "Enregistrer le tissu",
      saveOrder: "Enregistrer l'ordre",
      saveSofa: "Enregistrer le canapé",
      unpublishSofa: "Retirer la publication",
      upload: "Envoyer",
      uploadManualRender: "Envoyer un rendu manuel",
      useCandidate: "Utiliser la variante",
    },
    busy: {
      adding: "Ajout",
      archiving: "Archivage",
      creating: "Création",
      deleting: "Suppression",
      preparingZipExport: "Préparation de l'export ZIP",
      publishing: "Publication",
      queueing: "Mise en file",
      restoring: "Restauration",
      saving: "Enregistrement",
      unpublishing: "Retrait de la publication",
      working: "Travail en cours",
    },
    empty: {
      noAssignedFabrics: "Aucun tissu associé.",
      noCandidates: "Aucune variante",
      noFabricRecords: "Aucun tissu pour le moment.",
      noMatchingTags: "Aucune étiquette trouvée.",
      noRenderCoverage: "Aucune couverture de rendu.",
      noSofaRecords: "Aucun canapé pour le moment.",
      noSourceImage: "Aucune image source",
      noSwatch: "Aucun échantillon",
      noTags: "Aucune étiquette.",
      noTagsSelected: "Aucune étiquette sélectionnée.",
      noVisibleSofas:
        "Aucun canapé visible. Utilisez Archive pour afficher les canapés archivés.",
    },
    feedback: {
      cropSaved: "Recadrage enregistré",
      duplicateFabricOrder: "Un autre tissu utilise déjà cet ordre public.",
      fabricImagesRequired: "Les images du tissu sont obligatoires.",
      invalidWholeEuroPrice: "Le prix doit être un montant entier en euros.",
      requestFailed: "La demande a échoué.",
      sourceFabricRequired:
        "Choisissez un tissu source avant d'enregistrer cette image source.",
      sourceImageRequired:
        "Envoyez une image source avant d'associer un tissu source à cette colonne.",
    },
    labels: {
      activeJobs: "Tâches actives",
      aiReference: "Référence IA",
      aiReferenceImage: "Image de référence IA",
      aiReferencePreview: "Aperçu de la référence IA",
      adminLabel: "Libellé admin",
      assignFabric: "Associer un tissu",
      blockers: "Blocages",
      candidates: "Variantes",
      currentRender: "Rendu actuel",
      dimensions: "Dimensions",
      fabric: "Tissu",
      fabricAssignments: "Tissus associés",
      fabricState: "État du tissu",
      fabrics: "Tissus",
      filters: "Filtres",
      identity: "Identité",
      internalFabricName: "Nom interne du tissu",
      internalName: "Nom interne",
      job: "Tâche",
      length: "Longueur",
      depth: "Profondeur",
      height: "Hauteur",
      manualRender: "Rendu manuel",
      matchingTags: "Étiquettes trouvées",
      newTag: "Nouvelle étiquette",
      optionalNote: "Note facultative",
      order: "Ordre",
      price: "Prix",
      publicContent: "Contenu public",
      publicDescription: "Description publique",
      publicFabricName: "Nom public du tissu",
      publicLabel: "Libellé public",
      publicName: "Nom public",
      publicOrder: "Ordre public",
      renders: "Rendus",
      renderCell: "Cellule de rendu",
      renderCoverage: "Couverture des rendus",
      renderCoverageSummary: "Résumé de la couverture des rendus",
      renderZipExport: "Export ZIP des rendus",
      searchTags: "Rechercher des étiquettes",
      selectedTags: "Étiquettes sélectionnées",
      shopifyOrderUrl: "URL de commande Shopify",
      slug: "Adresse",
      sofaBasics: "Infos du canapé",
      sofaEditWorkflow: "Parcours de modification du canapé",
      source: "Source",
      sourceFabric: "Tissu source",
      sourcePhoto: "Photo source",
      status: "Statut",
      statusKey: "Légende des statuts",
      swatchCrop: "Recadrage de l'échantillon",
      swatchCropPreview: "Aperçu du recadrage de l'échantillon",
      swatchImage: "Image d'échantillon",
      swatchZoom: "Zoom de l'échantillon",
      tags: "Étiquettes",
      total: "Total",
      type: "Type",
      updated: "Mis à jour",
      viewColumns: "Colonnes de vue",
      workflow: "Parcours",
    },
    loading: {
      fabric: "Chargement du tissu.",
      fabrics: "Chargement des tissus.",
      sofa: "Chargement du canapé.",
      sofas: "Chargement des canapés.",
      tags: "Chargement des étiquettes.",
    },
    metadataTitles: {
      dashboard: "Tableau de bord admin | Mobel Unique",
      editFabric: "Modifier le tissu | Mobel Unique",
      editSofa: "Modifier le canapé | Mobel Unique",
      fabrics: "Tissus | Mobel Unique",
      login: "Connexion admin | Mobel Unique",
      newFabric: "Créer un tissu | Mobel Unique",
      newSofa: "Créer un canapé | Mobel Unique",
      sofas: "Canapés | Mobel Unique",
      tags: "Étiquettes | Mobel Unique",
    },
    pages: {
      createFabricDescription:
        "Créez une fiche tissu avec un échantillon et une image de référence IA.",
      createFabricTitle: "Créer un tissu",
      createSofaDescription:
        "Créez un brouillon avant d'associer les tissus et les rendus.",
      createSofaTitle: "Créer un canapé",
      fabricsDescription:
        "Vérifiez les échantillons, les noms publics, l'état et la préparation IA.",
      fabricsTitle: "Tissus",
      listEyebrow: "Catalogue",
      sofasDescription:
        "Vérifiez les canapés, les images sources, la publication et les dernières mises à jour.",
      sofasTitle: "Canapés",
      tagsDescription:
        "Créez et maintenez les étiquettes publiques utilisées pour organiser les filtres du catalogue.",
      tagsTitle: "Étiquettes",
    },
  },
  dashboard: {
    actions: {
      fabrics: {
        description:
          "Gérer les échantillons, les références et l'ordre d'affichage.",
        kicker: "Matières",
        label: "Tissus",
      },
      newSofa: {
        description: "Commencer une nouvelle fiche canapé.",
        kicker: "Création",
        label: "Nouveau canapé",
      },
      sofas: {
        description:
          "Gérer les fiches canapé, les dimensions et l'état de publication.",
        kicker: "Catalogue",
        label: "Canapés",
      },
      tags: {
        description: "Organiser les filtres du catalogue public.",
        kicker: "Classement",
        label: "Étiquettes",
      },
    },
    actionsAriaLabel: "Actions du catalogue",
    description:
      "Gérez le contenu du catalogue, les tissus, les étiquettes et la préparation visuelle depuis un seul espace.",
    eyebrow: "Espace de travail",
    signOut: "Se déconnecter",
    title: "Tableau de bord admin",
  },
  errors: {
    codes: {
      ADMIN_REQUIRED: "Ce compte ne peut pas ouvrir l'espace admin.",
      ASSET_PREVIEW_UNAVAILABLE:
        "L'aperçu de l'image n'est pas disponible pour le moment. Réessayez.",
      AUTH_INVALID: "Votre session admin a expiré. Connectez-vous à nouveau.",
      AUTH_REQUIRED: "Connectez-vous à nouveau pour continuer.",
      CATALOG_UNAVAILABLE: "Le service catalogue est indisponible.",
      FABRIC_ARCHIVED: "Ce tissu est archivé et ne peut pas être utilisé.",
      FABRIC_CONFLICT:
        "Un autre tissu utilise déjà ces informations publiques.",
      FABRIC_NOT_FOUND: "Le tissu est introuvable.",
      FABRIC_RENDER_CANDIDATE_NOT_FOUND:
        "La variante d'image est introuvable.",
      FABRIC_RENDER_JOB_CONFLICT:
        "Une tâche de génération équivalente est déjà active.",
      FABRIC_RENDER_JOB_FAILED: "La génération de l'image a échoué.",
      FABRIC_RENDER_JOB_NOT_FOUND:
        "La tâche de génération d'image est introuvable.",
      FABRIC_RENDER_QUEUED_JOB_NOT_FOUND:
        "La tâche en file pour cette cellule est introuvable.",
      FABRIC_RENDER_SOFA_PROCESSING_CONFLICT:
        "Une autre génération est déjà en cours. Attendez qu'elle se termine avant de relancer une cellule en file.",
      FABRIC_RENDER_WORKER_INVOKE_FAILED:
        "La génération de l'image n'a pas pu démarrer. Réessayez.",
      IMAGE_DECODE_FAILED:
        "L'image n'a pas pu être lue. Choisissez une autre image.",
      IMAGE_PREPARATION_UNAVAILABLE:
        "La préparation de l'image n'est pas disponible dans ce navigateur.",
      INVALID_JSON: "Le corps de la demande doit être un JSON valide.",
      INVALID_REQUEST:
        "Certaines données saisies sont manquantes ou invalides.",
      INVALID_STORAGE_ASSET_VARIANT:
        "Cette variante d'aperçu n'est pas disponible.",
      MANUAL_RENDER_NOT_FOUND: "Le rendu manuel est introuvable.",
      MANUAL_RENDER_REQUIRED:
        "Choisissez une image avant d'envoyer un rendu manuel.",
      REFINE_PROMPT_REQUIRED:
        "Écrivez ce qui doit être amélioré avant de lancer l'amélioration.",
      RENDER_CELL_NOT_FOUND: "La cellule de rendu est introuvable.",
      SOFA_CONFLICT:
        "Ce canapé ne peut pas être modifié dans son état actuel.",
      SOFA_FABRIC_NOT_FOUND: "Cette ligne de tissu est introuvable.",
      SOFA_FABRIC_ORDER_CONFLICT:
        "Un autre tissu utilise déjà cet ordre public.",
      SOFA_NOT_FOUND: "Le canapé est introuvable.",
      SOFA_RENDER_EXPORT_NOT_FOUND: "L'export des rendus est introuvable.",
      STORAGE_ASSET_NOT_FOUND: "L'image enregistrée est introuvable.",
      TAG_CONFLICT:
        "Une étiquette utilise déjà ce libellé ou cette adresse.",
      TAG_IN_USE:
        "Cette étiquette est déjà utilisée par un canapé et ne peut pas être supprimée.",
      TAG_NOT_FOUND: "L'étiquette est introuvable.",
      UNSUPPORTED_FIELD: "Certaines données ne peuvent pas être enregistrées ici.",
      UNSUPPORTED_MEDIA_TYPE: "Le corps de la demande doit être en JSON.",
      UPLOAD_FAILED: "L'envoi de l'image a échoué. Réessayez.",
      UPLOAD_NOT_FOUND: "L'envoi est introuvable ou a expiré.",
      UPLOAD_VARIANTS_FAILED:
        "L'image a été envoyée, mais les aperçus n'ont pas pu être créés. Réessayez.",
      VALIDATION_FAILED:
        "Certaines données saisies sont manquantes ou invalides.",
      VISUAL_MATRIX_COLUMN_CONFLICT:
        "Une autre colonne de vue utilise déjà ces informations.",
      VISUAL_MATRIX_COLUMN_NOT_FOUND: "La colonne de vue est introuvable.",
    },
    generic: "Une erreur est survenue. Réessayez.",
  },
  login: {
    description:
      "Utilisez votre compte admin pour gérer le catalogue Mobel Unique.",
    eyebrow: "Espace sécurisé",
    form: {
      emailLabel: "Adresse e-mail",
      genericError: "Connexion impossible avec ces identifiants.",
      passwordLabel: "Mot de passe",
      submitLabel: "Se connecter",
      submitBusyLabel: "Connexion en cours",
      signInFailed: "La connexion admin n'a pas pu être terminée.",
    },
    title: "Connexion admin",
  },
  publicationBlockers: {
    INCOMPLETE_PUBLIC_RENDER_COVERAGE: "Rendus publics manquants",
    MISSING_ACTIVE_VISUAL_POSITION: "Vue active manquante",
    MISSING_FABRIC_AI_REFERENCE: "Image de référence tissu manquante",
    MISSING_FROZEN_PUBLIC_SLUG: "Lien public pas encore prêt",
    MISSING_OR_INVALID_SHOPIFY_ORDER_URL:
      "Lien Shopify à corriger",
    MISSING_PUBLIC_FABRIC: "Aucun tissu public",
    MISSING_PUBLIC_NAME: "Nom public manquant",
    MISSING_PUBLIC_SWATCH_ASSET: "Échantillon tissu manquant",
    MISSING_SOURCE_PHOTO: "Photo source manquante",
    SOURCE_PHOTO_MISSING: "Photo source manquante",
  },
  readiness: {
    blocked: "Bloqué",
    missing: "Manquant",
    partial: "Partiel",
    ready: "Prêt",
  },
  renderCellBlockers: {
    MISSING_FABRIC_AI_REFERENCE: "Image de référence tissu manquante",
    MISSING_SOURCE_PHOTO: "Photo source manquante",
    SOURCE_PHOTO_MISSING: "Photo source manquante",
  },
  renderCellStatuses: {
    blocked: "Bloqué",
    candidate: "Variante",
    failed: "Échec",
    missing: "Manquant",
    processing: "En cours",
    queued: "En file",
    ready: "Prêt",
  },
  shell: {
    brand: "MOBEL UNIQUE",
    navigation: {
      dashboard: "Tableau de bord",
      fabrics: "Tissus",
      sofas: "Canapés",
      tags: "Étiquettes",
    },
    navigationAriaLabel: "Administration",
  },
  sourceTypes: {
    ai_generated: "Généré par IA",
    manual_upload: "Envoi manuel",
    source_photo: "Photo source",
    unknown: "Inconnu",
  },
  sofaLifecycle: {
    active: "Actif",
    archived: "Archivé",
    draft: "Brouillon",
    published: "Publié",
  },
} as const;

export const ADMIN_ERROR_MESSAGES = ADMIN_COPY.errors.codes;
export const ADMIN_PUBLICATION_BLOCKER_LABELS =
  ADMIN_COPY.publicationBlockers;
export const RENDER_CELL_BLOCKER_LABELS = ADMIN_COPY.renderCellBlockers;

const TECHNICAL_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

export function formatAdminErrorCodeMessage(code: string) {
  const message = code.trim();

  if (!message) {
    return ADMIN_COPY.errors.generic;
  }

  return ADMIN_ERROR_MESSAGES[message as keyof typeof ADMIN_ERROR_MESSAGES] ??
    ADMIN_COPY.errors.generic;
}

export function isTechnicalAdminErrorCode(message: string) {
  return TECHNICAL_ERROR_CODE_PATTERN.test(message);
}

export function formatAdminLifecycleLabel(lifecycleState: string) {
  return (
    ADMIN_COPY.sofaLifecycle[
      lifecycleState as keyof typeof ADMIN_COPY.sofaLifecycle
    ] ?? humanizeAdminToken(lifecycleState)
  );
}

export function formatAdminReadinessLabel(kind: string) {
  return (
    ADMIN_COPY.readiness[kind as keyof typeof ADMIN_COPY.readiness] ??
    humanizeAdminToken(kind)
  );
}

export function formatRenderCellStatusLabel(status: string) {
  return (
    ADMIN_COPY.renderCellStatuses[
      status as keyof typeof ADMIN_COPY.renderCellStatuses
    ] ?? humanizeAdminToken(status)
  );
}

export function formatSourceTypeLabel(sourceType: string) {
  return (
    ADMIN_COPY.sourceTypes[sourceType as keyof typeof ADMIN_COPY.sourceTypes] ??
    (sourceType ? humanizeAdminToken(sourceType) : ADMIN_COPY.sourceTypes.unknown)
  );
}

export function formatAdminPublicationBlockerLabel(code: string) {
  return (
    ADMIN_PUBLICATION_BLOCKER_LABELS[
      code as keyof typeof ADMIN_PUBLICATION_BLOCKER_LABELS
    ] ?? "La publication demande une vérification"
  );
}

export function formatRenderCellBlockerLabel(code: string) {
  return (
    RENDER_CELL_BLOCKER_LABELS[
      code as keyof typeof RENDER_CELL_BLOCKER_LABELS
    ] ?? "Entrée manquante"
  );
}

export function formatUploadPreparationMessage(
  input: AdminUploadPreparationMessageInput,
) {
  if (input.kind === "fabric_swatch_crop") {
    return "L'échantillon a été recadré en carré 512x512 avant l'envoi.";
  }

  if (input.convertedWebp && input.resized) {
    return `L'image a été convertie de WebP en JPEG et réduite de ${input.width}x${input.height} à ${input.targetWidth}x${input.targetHeight} avant l'envoi.`;
  }

  if (input.convertedWebp) {
    return "L'image a été convertie de WebP en JPEG avant l'envoi.";
  }

  return `L'image a été réduite de ${input.width}x${input.height} à ${input.targetWidth}x${input.targetHeight} avant l'envoi.`;
}

function humanizeAdminToken(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
