"use client";

import { ChevronLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();

  function goBack() {
    router.replace("/app");
  }

  return (
    <Button
      aria-label="Volver"
      className="rounded-full"
      onClick={goBack}
      size="icon"
      type="button"
      variant="outline"
    >
      <ChevronLeftIcon />
    </Button>
  );
}
