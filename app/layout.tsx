import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rumbo · Planificador de viajes",
  description: "Planificador inteligente de itinerarios de viaje.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
