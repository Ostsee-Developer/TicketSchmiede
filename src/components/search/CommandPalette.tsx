"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Users, Cpu, Ticket, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  position: string | null;
  department: string | null;
  status: string;
}
interface SearchDevice {
  id: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  hostname: string | null;
  status: string;
}
interface SearchTicket {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}
interface SearchResults {
  employees: SearchEmployee[];
  devices: SearchDevice[];
  tickets: SearchTicket[];
  query: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  WAITING_FOR_CUSTOMER: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
  ACTIVE: "bg-green-100 text-green-700",
  DISABLED: "bg-red-100 text-red-700",
  LEFT: "bg-gray-100 text-gray-500",
  IN_STORAGE: "bg-yellow-100 text-yellow-700",
  IN_REPAIR: "bg-orange-100 text-orange-700",
  DECOMMISSIONED: "bg-gray-100 text-gray-400",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
}

export function CommandPalette({ isOpen, onClose, tenantId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, 300);

  // Extract tenantId from URL if not provided
  const effectiveTenantId =
    tenantId ?? pathname.match(/^\/tenants\/([^/]+)/)?.[1];

  const flatResults = results
    ? [
        ...results.employees.map((e) => ({
          type: "employee" as const,
          id: e.id,
          label: `${e.firstName} ${e.lastName}`,
          sub: e.position ?? e.department ?? e.email ?? "",
          status: e.status,
          href: effectiveTenantId
            ? `/tenants/${effectiveTenantId}/employees/${e.id}`
            : "#",
        })),
        ...results.devices.map((d) => ({
          type: "device" as const,
          id: d.id,
          label: [d.manufacturer, d.model].filter(Boolean).join(" ") || d.type,
          sub: d.hostname ?? d.type,
          status: d.status,
          href: effectiveTenantId
            ? `/tenants/${effectiveTenantId}/devices/${d.id}`
            : "#",
        })),
        ...results.tickets.map((t) => ({
          type: "ticket" as const,
          id: t.id,
          label: t.title,
          sub: `#${t.number}`,
          status: t.status,
          href: effectiveTenantId
            ? `/tenants/${effectiveTenantId}/tickets/${t.id}`
            : "#",
        })),
      ]
    : [];

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    if (debouncedQuery.length < 2 || !effectiveTenantId) {
      setResults(null);
      return;
    }
    setLoading(true);
    fetch(
      `/api/search?q=${encodeURIComponent(debouncedQuery)}&tenantId=${effectiveTenantId}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setResults(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedQuery, effectiveTenantId]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatResults[selectedIndex]) {
        navigate(flatResults[selectedIndex].href);
      }
    },
    [flatResults, selectedIndex, navigate, onClose]
  );

  if (!isOpen) return null;

  const typeIcon = (type: string) => {
    if (type === "employee") return <Users className="w-4 h-4 shrink-0 text-blue-500" />;
    if (type === "device") return <Cpu className="w-4 h-4 shrink-0 text-purple-500" />;
    return <Ticket className="w-4 h-4 shrink-0 text-orange-500" />;
  };

  const sectionLabel = { employee: "Mitarbeiter", device: "Geräte", ticket: "Tickets" };
  let lastType = "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              effectiveTenantId
                ? "Mitarbeiter, Geräte, Tickets durchsuchen…"
                : "Bitte zuerst einen Mandanten auswählen"
            }
            disabled={!effectiveTenantId}
            className="flex-1 text-sm outline-none placeholder-gray-400 bg-transparent"
          />
          <div className="flex items-center gap-2">
            {loading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        {flatResults.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {flatResults.map((item, idx) => {
              const showSection = item.type !== lastType;
              lastType = item.type;
              return (
                <div key={`${item.type}-${item.id}`}>
                  {showSection && (
                    <p className="px-4 py-1.5 text-2xs font-semibold text-gray-400 uppercase tracking-widest">
                      {sectionLabel[item.type]}
                    </p>
                  )}
                  <button
                    onClick={() => navigate(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group",
                      idx === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
                    )}
                  >
                    {typeIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                      <p className="text-xs text-gray-500 truncate">{item.sub}</p>
                    </div>
                    <span
                      className={cn(
                        "text-2xs px-1.5 py-0.5 rounded-full font-medium shrink-0",
                        STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-500"
                      )}
                    >
                      {item.status}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {query.length >= 2 && !loading && flatResults.length === 0 && results && (
          <div className="py-10 text-center text-sm text-gray-400">
            Keine Ergebnisse für <span className="font-medium text-gray-600">&ldquo;{query}&rdquo;</span>
          </div>
        )}

        {query.length < 2 && !loading && (
          <div className="py-6 text-center text-xs text-gray-400 space-y-1">
            <p>Mindestens 2 Zeichen eingeben</p>
            <p className="text-gray-300">↑↓ Navigieren · Enter Öffnen · Esc Schließen</p>
          </div>
        )}

        {/* Keyboard hint footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-2xs text-gray-400">
          <span><kbd className="font-mono bg-gray-100 px-1 rounded">↑↓</kbd> Navigieren</span>
          <span><kbd className="font-mono bg-gray-100 px-1 rounded">↵</kbd> Öffnen</span>
          <span><kbd className="font-mono bg-gray-100 px-1 rounded">Esc</kbd> Schließen</span>
        </div>
      </div>
    </div>
  );
}
