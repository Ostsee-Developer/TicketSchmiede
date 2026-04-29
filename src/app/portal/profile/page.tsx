import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal-context";
import { ProfileSignOut } from "@/components/portal/profile-sign-out";

export const metadata = { title: "Profil – TicketSchmiede" };

export default async function PortalProfilePage() {
  const ctx = await getPortalContext();
  if (!ctx) redirect("/login");

  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Profil</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
            {ctx.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{ctx.userName}</p>
            <p className="text-sm text-gray-500">{ctx.userEmail}</p>
          </div>
        </div>

        {/* Info */}
        <dl className="space-y-3 text-sm border-t border-gray-100 pt-4">
          <div className="flex justify-between">
            <dt className="text-gray-500">Unternehmen</dt>
            <dd className="font-medium text-gray-900">{ctx.tenantName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Rolle</dt>
            <dd>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                ctx.isCustomerAdmin ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
              }`}>
                {ctx.isCustomerAdmin ? "Admin" : "Benutzer"}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <ProfileSignOut />
    </div>
  );
}
