import type { Metadata } from "next";
import SignatureClient from "./SignatureClient";

export const metadata: Metadata = {
  title: "Signature du contrat — BIA Manager",
  robots: { index: false, follow: false },
};

export default async function PageSignature({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SignatureClient token={token} />;
}
