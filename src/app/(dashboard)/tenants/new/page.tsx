"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { slugify } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Mindestens 2 Zeichen").max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche"),
  email: z.string().email("Ungültige E-Mail").or(z.literal("")).optional(),
  phone: z.string().optional(),
  website: z.string().url("Ungültige URL").or(z.literal("")).optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default("DE"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewTenantPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "DE" },
  });

  const nameValue = watch("name");

  const handleNameBlur = () => {
    if (nameValue) {
      setValue("slug", slugify(nameValue), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      router.push("/tenants");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tenants" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neuer Mandant</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Stammdaten</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register("name")}
                onBlur={handleNameBlur}
                type="text"
                placeholder="Musterfirma GmbH"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                {...register("slug")}
                type="text"
                placeholder="musterfirma-gmbh"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Eindeutiger URL-Name. Wird automatisch aus dem Namen generiert.</p>
              {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                {...register("email")}
                type="email"
                placeholder="info@firma.de"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                {...register("phone")}
                type="tel"
                placeholder="+49 123 456789"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                {...register("website")}
                type="url"
                placeholder="https://www.firma.de"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.website && <p className="mt-1 text-xs text-red-600">{errors.website.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Adresse</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Straße & Hausnummer</label>
              <input
                {...register("street")}
                type="text"
                placeholder="Musterstraße 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
              <input
                {...register("zipCode")}
                type="text"
                placeholder="12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
              <input
                {...register("city")}
                type="text"
                placeholder="Berlin"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
              <select
                {...register("country")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="DE">Deutschland</option>
                <option value="AT">Österreich</option>
                <option value="CH">Schweiz</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Notizen</h2>
          <textarea
            {...register("notes")}
            rows={4}
            placeholder="Interne Notizen zum Mandanten..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/tenants"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Speichern...
              </>
            ) : (
              "Mandant anlegen"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
