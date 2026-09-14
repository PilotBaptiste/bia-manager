import type { Metadata } from "next";
import "./globals.css";
import { getClubInfo, DEFAULT_CLUB_NOM } from "@/lib/club";
import { ClubProvider } from "@/contexts/ClubContext";

// Every page depends on the requesting host (club subdomain) and on the session: never prerender them.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const club = await getClubInfo();
  return {
    title: club.nom && club.nom !== DEFAULT_CLUB_NOM ? `BIA Manager — ${club.nom}` : "BIA Manager",
    description: "Gestion des élèves BIA, vols découverte et comptabilité",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const club = await getClubInfo();
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900">
        <ClubProvider club={club}>{children}</ClubProvider>
      </body>
    </html>
  );
}
