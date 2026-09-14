"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f9fafb", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 18, margin: "0 0 8px", color: "#111827" }}>Une erreur est survenue</h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 16px" }}>
              L&apos;équipe BIA Manager a été prévenue automatiquement. Réessayez dans un instant.
            </p>
            <button onClick={reset} style={{ background: "#1b3a5c", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
