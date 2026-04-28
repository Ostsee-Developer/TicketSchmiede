"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "ALL",                  label: "Alle" },
  { value: "NEW",                  label: "Neu" },
  { value: "IN_PROGRESS",          label: "In Bearbeitung" },
  { value: "WAITING_FOR_CUSTOMER", label: "Warte auf mich" },
  { value: "RESOLVED",             label: "Gelöst" },
  { value: "CLOSED",               label: "Geschlossen" },
];

interface Props {
  currentStatus?: string;
  currentSearch?: string;
}

export function TicketSearchBar({ currentStatus, currentSearch }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: { status?: string; search?: string }) => {
      const params = new URLSearchParams();
      const status = updates.status ?? currentStatus;
      const search = updates.search ?? currentSearch;
      if (status && status !== "ALL") params.set("status", status);
      if (search) params.set("search", search);
      const qs = params.toString();
      startTransition(() => {
        router.push(`${pathname}${qs ? `?${qs}` : ""}`);
      });
    },
    [currentStatus, currentSearch, pathname, router]
  );

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback(
    (value: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => updateParams({ search: value || undefined }), 300);
    },
    [updateParams]
  );

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Search input */}
      <div className="relative flex-1">
        <svg
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
            isPending ? "text-blue-500 animate-pulse" : "text-gray-400"
          }`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          defaultValue={currentSearch}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Tickets durchsuchen…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
        {STATUS_OPTIONS.map((opt) => {
          const active = (currentStatus ?? "ALL") === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => updateParams({ status: opt.value })}
              className={`shrink-0 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
