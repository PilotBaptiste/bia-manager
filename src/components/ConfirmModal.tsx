"use client";

import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  reasonLabel?: string;       // if set, shows a textarea and passes the value to onConfirm
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
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
  reasonLabel,
  reasonPlaceholder = "Précisez la raison…",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!open) setReason(""); }, [open]);

  if (!open || !mounted) return null;

  const confirmCls =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-[#1b3a5c] hover:bg-[#15304e] text-white";

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="absolute inset-0 bg-black/50" onClick={() => !loading && onCancel()} />
      <div
        className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4 whitespace-pre-line">{message}</p>
        {reasonLabel && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">{reasonLabel}</label>
            <textarea
              className="input text-sm resize-none"
              rows={3}
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(reasonLabel ? reason.trim() || undefined : undefined)}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 ${confirmCls}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
