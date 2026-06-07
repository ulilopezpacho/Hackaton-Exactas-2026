import "@fontsource-variable/newsreader";
import "@fontsource-variable/onest";

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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
