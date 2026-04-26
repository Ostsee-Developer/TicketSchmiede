import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ticketschmiede.de";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Change_me_123!";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Super Admin";

  // Super Admin User
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
        isSuperAdmin: true,
        isActive: true,
      },
    });
    console.log(`✅ Super Admin created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Super Admin already exists: ${adminEmail}`);
  }

  // Credential Templates
  const templates = [
    { name: "Microsoft 365 / Outlook", category: "Microsoft", usernameHint: "vorname.nachname@firma.de", urlHint: "https://portal.office.com" },
    { name: "Windows Benutzerkonto", category: "Windows", usernameHint: "Domäne\\Benutzername" },
    { name: "VPN Zugang", category: "Netzwerk", usernameHint: "VPN-Benutzername", urlHint: "vpn.firma.de" },
    { name: "WLAN / WiFi", category: "Netzwerk", usernameHint: "SSID" },
    { name: "AutoCAD", category: "CAD/Software", usernameHint: "Autodesk Account E-Mail", urlHint: "https://accounts.autodesk.com" },
    { name: "Webportal / Kundenportal", category: "Web", usernameHint: "Benutzername oder E-Mail" },
    { name: "Router / Firewall Admin", category: "Netzwerkgerät", usernameHint: "admin" },
    { name: "NAS / Server Login", category: "Server", usernameHint: "Benutzername" },
    { name: "Drucker / Scanner Admin", category: "Gerät", urlHint: "http://drucker-ip" },
    { name: "RDP / Fernzugang", category: "Fernzugang", usernameHint: "Benutzername oder E-Mail" },
    { name: "Datev", category: "Steuer/Buchhaltung", usernameHint: "Datev-Berater-Nr" },
    { name: "Google Workspace", category: "Google", usernameHint: "vorname@firma.de", urlHint: "https://workspace.google.com" },
  ];

  for (const tpl of templates) {
    await prisma.credentialTemplate.upsert({
      where: { id: tpl.name }, // use name as id placeholder for upsert
      update: {},
      create: tpl,
    }).catch(async () => {
      // upsert by name lookup
      const exists = await prisma.credentialTemplate.findFirst({ where: { name: tpl.name } });
      if (!exists) {
        await prisma.credentialTemplate.create({ data: tpl });
        console.log(`  + Template: ${tpl.name}`);
      }
    });
  }
  console.log("✅ Credential templates seeded");

  // Device Templates
  const deviceTemplates = [
    { name: "Standard Laptop", type: "LAPTOP" as const, manufacturer: "Lenovo", model: "ThinkPad" },
    { name: "Standard PC", type: "PC" as const, manufacturer: "HP", model: "EliteDesk" },
    { name: "Standard Drucker", type: "PRINTER" as const, manufacturer: "HP" },
    { name: "Standard Server", type: "SERVER" as const },
    { name: "Standard Switch", type: "SWITCH" as const, manufacturer: "Cisco" },
    { name: "Standard Firewall", type: "FIREWALL" as const },
    { name: "Standard NAS", type: "NAS" as const },
    { name: "Standard Smartphone", type: "SMARTPHONE" as const },
  ];

  for (const dt of deviceTemplates) {
    const exists = await prisma.deviceTemplate.findFirst({ where: { name: dt.name } });
    if (!exists) {
      await prisma.deviceTemplate.create({ data: dt });
    }
  }
  console.log("✅ Device templates seeded");

  console.log("\n🎉 Database seeding complete!");
  console.log(`\n📧 Admin Login: ${adminEmail}`);
  console.log("🔐 Change your password after first login!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
