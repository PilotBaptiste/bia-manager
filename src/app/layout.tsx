import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIA Manager — Aéro-Club du Bassin d'Arcachon",
  description: "Gestion des élèves BIA, vols découverte et comptabilité",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
