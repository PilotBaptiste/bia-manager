"use client";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Eraser } from "lucide-react";

/**
 * Cadre de signature : on y trace sa signature au doigt ou à la souris.
 * Renvoie un PNG en data URL, ou null tant que rien n'a été tracé.
 */
export default function PadSignature({
  onChange,
  valeurInitiale,
  hauteur = 150,
}: {
  onChange: (dataUrl: string | null) => void;
  valeurInitiale?: string | null;
  hauteur?: number;
}) {
  const ref = useRef<SignatureCanvas | null>(null);
  // Une signature déjà enregistrée s'affiche telle quelle : on ne la redessine
  // que si on veut la remplacer.
  const [conserve, setConserve] = useState(!!valeurInitiale);
  const [vide, setVide] = useState(true);

  function effacer() {
    ref.current?.clear();
    setVide(true);
    onChange(null);
  }

  function fini() {
    const pad = ref.current;
    if (!pad || pad.isEmpty()) { setVide(true); onChange(null); return; }
    setVide(false);
    onChange(pad.toDataURL("image/png"));
  }

  if (conserve && valeurInitiale) {
    return (
      <div>
        <div
          className="rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden"
          style={{ height: hauteur }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valeurInitiale} alt="Votre signature enregistrée" className="max-h-full max-w-full object-contain" />
        </div>
        <button
          type="button"
          onClick={() => { setConserve(false); onChange(null); }}
          className="text-xs text-gray-400 hover:text-brand-500 mt-1.5"
        >
          Tracer une nouvelle signature
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden" style={{ height: hauteur }}>
        <SignatureCanvas
          ref={(r) => { ref.current = r; }}
          penColor="#1b3a5c"
          onEnd={fini}
          canvasProps={{ className: "w-full h-full touch-none", style: { width: "100%", height: hauteur } }}
        />
        {vide && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 pointer-events-none">
            Signez ici, au doigt ou à la souris
          </p>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-gray-400">Votre tracé sera reproduit sur le contrat.</p>
        <button type="button" onClick={effacer} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
          <Eraser className="w-3 h-3" /> Effacer
        </button>
      </div>
    </div>
  );
}
