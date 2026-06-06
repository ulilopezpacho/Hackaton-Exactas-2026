import { cn } from "@/lib/utils";

const palettes = [
  "from-[#e3b79c] to-[#a95437]",
  "from-[#c7d4b2] to-[#607b4e]",
  "from-[#a9c3d6] to-[#4f748a]",
  "from-[#e7cba1] to-[#ad7944]",
  "from-[#d6b4c6] to-[#84536f]",
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,.5),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/25 to-transparent" />
    </div>
  );
}
