"use client";

import { CheckIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ShareTripButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      aria-label={copied ? "Enlace copiado" : "Compartir viaje"}
      onClick={share}
      size="icon-lg"
      variant="outline"
    >
      {copied ? <CheckIcon /> : <Share2Icon />}
    </Button>
  );
}
