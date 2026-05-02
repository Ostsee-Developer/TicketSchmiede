import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSettingsClient } from "./AccountSettingsClient";

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });

  if (!user) redirect("/login");

  return <AccountSettingsClient initialUser={user} />;
}
