import { cn } from "@/lib/utils";

const palettes = [
  "from-[#dcece6] to-[#0b5d4b]",
  "from-[#e1eef4] to-[#2f6f91]",
  "from-[#f8ecd3] to-[#9a6a20]",
  "from-[#eee8f2] to-[#755a8a]",
  "from-[#fbe5df] to-[#c9472e]",
];

export function PlaceArt({
  className,
  seed,
}: {
  className?: string;
  seed: string;
}) {
  const hash = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-linear-to-br",
        palettes[hash % palettes.length],
        className,
      )}
    >
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(115deg,transparent_0_28%,rgba(255,255,255,.38)_28%_30%,transparent_30%_55%,rgba(255,255,255,.24)_55%_57%,transparent_57%),linear-gradient(25deg,transparent_0_42%,rgba(23,35,31,.18)_42%_44%,transparent_44%)]" />
      <div className="absolute -right-8 -top-10 size-28 rounded-full border border-white/40" />
      <div className="absolute -bottom-12 left-4 size-24 rounded-full border border-white/30" />
    </div>
  );
}
