import { BackButton } from "@/components/app/back-button";
import { PageShell } from "@/components/app/page-shell";

import { TripDestinationForm } from "./trip-destination-form";

type DestinationPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function DestinationPage({
  searchParams,
}: DestinationPageProps) {
  const { error } = await searchParams;

  return (
    <PageShell
      actions={<BackButton />}
      eyebrow="Nuevo viaje"
      title="Empecemos por lo básico"
    >
      <TripDestinationForm error={error} />
    </PageShell>
  );
}
