"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  apiPath: string;
  label?: string;
  confirmText?: string;
  onSuccess?: () => void;
}

export function DeleteButton({ apiPath, label = "Löschen", confirmText = "Wirklich löschen?", onSuccess }: DeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(apiPath, { method: "DELETE" });
    setLoading(false);
    if (res.ok || res.status === 204) {
      setConfirming(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Fehler beim Löschen");
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        {error && <span className="text-xs text-red-600 mr-1">{error}</span>}
        <span className="text-xs text-gray-500">{confirmText}</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-600 hover:text-red-800 font-medium ml-1 disabled:opacity-50"
        >
          {loading ? "..." : "Ja"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600 font-medium ml-1"
        >
          Nein
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-red-500 hover:text-red-700 font-medium"
    >
      {label}
    </button>
  );
}
