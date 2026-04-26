"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

const DEVICE_TYPES = ["LAPTOP", "PC", "SERVER", "PRINTER", "FIREWALL", "SWITCH", "ROUTER", "SMARTPHONE", "TABLET", "MONITOR", "DOCKING_STATION", "NAS", "ACCESS_POINT", "UPS", "OTHER"] as const;
const DEVICE_TYPE_LABELS: Record<string, string> = {
  LAPTOP: "Laptop", PC: "PC", SERVER: "Server", PRINTER: "Drucker", FIREWALL: "Firewall",
  SWITCH: "Switch", ROUTER: "Router", SMARTPHONE: "Smartphone", TABLET: "Tablet",
  MONITOR: "Monitor", DOCKING_STATION: "Docking Station", NAS: "NAS",
  ACCESS_POINT: "Access Point", UPS: "USV", OTHER: "Sonstiges",
};

const schema = z.object({
  type: z.enum(DEVICE_TYPES),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  inventoryNumber: z.string().optional(),
  hostname: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  os: z.string().optional(),
  osVersion: z.string().optional(),
  status: z.enum(["ACTIVE", "IN_STORAGE", "IN_REPAIR", "DECOMMISSIONED", "LOST"]).default("ACTIVE"),
  purchaseDate: z.string().optional(),
  warrantyUntil: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewDevicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "ACTIVE", type: "LAPTOP" },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const payload = {
      ...data,
      tenantId: id,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : null,
      warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil).toISOString() : null,
    };
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push(`/tenants/${id}/devices`);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tenants/${id}/devices`} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neues Gerät</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Gerätedaten</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gerätetyp <span className="text-red-500">*</span></label>
              <select {...register("type")} className={inp}>
                {DEVICE_TYPES.map((t) => <option key={t} value={t}>{DEVICE_TYPE_LABELS[t]}</option>)}
              </select>
              {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...register("status")} className={inp}>
                <option value="ACTIVE">Aktiv</option>
                <option value="IN_STORAGE">Lager</option>
                <option value="IN_REPAIR">Reparatur</option>
                <option value="DECOMMISSIONED">Ausgemustert</option>
                <option value="LOST">Verloren</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
              <input {...register("manufacturer")} type="text" placeholder="Lenovo, HP, Dell..." className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modell</label>
              <input {...register("model")} type="text" placeholder="ThinkPad T14" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
              <input {...register("serialNumber")} type="text" className={inp + " font-mono"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inventarnummer</label>
              <input {...register("inventoryNumber")} type="text" className={inp + " font-mono"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
              <input {...register("hostname")} type="text" placeholder="PC-001" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP-Adresse</label>
              <input {...register("ipAddress")} type="text" placeholder="192.168.1.100" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MAC-Adresse</label>
              <input {...register("macAddress")} type="text" placeholder="00:1A:2B:3C:4D:5E" className={inp + " font-mono"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Betriebssystem</label>
              <input {...register("os")} type="text" placeholder="Windows 11" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kaufdatum</label>
              <input {...register("purchaseDate")} type="date" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Garantie bis</label>
              <input {...register("warrantyUntil")} type="date" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea {...register("notes")} rows={3} className={inp + " resize-none"} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/tenants/${id}/devices`} className={btnSecondary}>Abbrechen</Link>
          <button type="submit" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? "Speichern..." : "Gerät anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
const btnPrimary = "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors";
const btnSecondary = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors";
