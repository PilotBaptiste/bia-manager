"use client";

import { Loader2 } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmCls =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-[#1b3a5c] hover:bg-[#15304e] text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onCancel()} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 ${confirmCls}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
