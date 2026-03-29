"use client";
import { QRCodeSVG } from "qrcode.react";
import { MessageCircle, Smartphone, ExternalLink } from "lucide-react";

const WHATSAPP_NUMBER = "33756919167";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20sur%20BIA%20Manager.`;

export default function SupportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Support</h1>
        <p className="text-sm text-gray-500 mt-0.5">Contactez-nous en cas de problème</p>
      </div>

      <div className="max-w-lg">
        <div className="card text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#25D366" }}>
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1">Contactez-nous sur WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-6">
            Notre équipe est disponible pour vous aider en cas de problème avec la plateforme.
          </p>

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-sm inline-block">
              <QRCodeSVG
                value={WHATSAPP_URL}
                size={180}
                fgColor="#1b3a5c"
                bgColor="#ffffff"
                level="M"
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
            <Smartphone className="w-4 h-4 flex-shrink-0" />
            <span>Scannez avec votre téléphone pour ouvrir WhatsApp</span>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Direct link */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full justify-center"
            style={{ backgroundColor: "#25D366", borderColor: "#25D366" }}
          >
            <MessageCircle className="w-4 h-4" />
            Ouvrir WhatsApp directement
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>

          <p className="text-xs text-gray-400 mt-4">
            Numéro support : 07 56 91 91 67
          </p>
        </div>

        <div className="card mt-4 bg-blue-50 border-blue-100">
          <p className="text-sm text-blue-800 font-medium mb-1">Avant de nous contacter</p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Précisez votre nom et établissement</li>
            <li>Décrivez le problème rencontré</li>
            <li>Indiquez si possible une capture d'écran</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
