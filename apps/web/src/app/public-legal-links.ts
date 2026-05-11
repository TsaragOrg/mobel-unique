export const PUBLIC_PRIVACY_POLICY_HREF = "/politique-de-confidentialite";

export const PUBLIC_PRIVACY_POLICY_LABEL = "Politique de confidentialité";

export const PUBLIC_LEGAL_NOTICE_HREF = "/mentions-legales";

export const PUBLIC_LEGAL_NOTICE_LABEL = "Mentions legales";

export const PUBLIC_LEGAL_LINKS = [
  {
    href: PUBLIC_PRIVACY_POLICY_HREF,
    label: PUBLIC_PRIVACY_POLICY_LABEL,
  },
  {
    href: PUBLIC_LEGAL_NOTICE_HREF,
    label: PUBLIC_LEGAL_NOTICE_LABEL,
  },
] as const;
