"use client";

import { useRouter } from "next/navigation";

import { PublicShell } from "../../../../PublicShell";
import { EmailGateForm } from "../../../../../components/simulation/EmailGateForm";

export interface PublicSimulationEmailGateProps {
  slug: string;
  navigateToWizard?: (slug: string) => void;
}

export function PublicSimulationEmailGate(
  props: PublicSimulationEmailGateProps
) {
  const router = useRouter();

  function handleVerified() {
    if (props.navigateToWizard) {
      props.navigateToWizard(props.slug);
      return;
    }
    router.replace(`/sofas/${props.slug}/simulate`);
  }

  return (
    <PublicShell currentPath="detail">
      <a className="public-back-link" href={`/sofas/${props.slug}`}>
        Retour au canapé
      </a>
      <EmailGateForm onVerified={handleVerified} />
    </PublicShell>
  );
}
