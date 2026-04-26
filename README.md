# Ticket Schmiede

Mandantenfähiges IT-Helpdesk- und Asset-Management-System auf Basis von Next.js 15.

## Features

- **Ticketing** — Support-Tickets mit Priorität, Kategorie, Zeiterfassung und Kommentaren
- **Asset Management** — Geräte, Arbeitsstationen und Software inkl. Lizenzverwaltung
- **Mitarbeiterverwaltung** — Mitarbeiter, Standorte, Gerätezuweisungen
- **Zugangsdaten** — AES-256-GCM-verschlüsselte Credential-Verwaltung
- **Mandantentrennung** — vollständige Datenisolation pro Kunde
- **RBAC** — Rollen: `SUPER_ADMIN`, `INTERNAL_ADMIN`, `TECHNICIAN`, `CUSTOMER_ADMIN`, `CUSTOMER_USER`, `READ_ONLY`
- **2FA** — TOTP-basierte Zwei-Faktor-Authentifizierung
- **Import / Export** — Excel-Import und -Export für Massendaten
- **Audit-Log** — lückenlose Protokollierung aller sicherheitsrelevanten Aktionen
- **Kunden-Portal** — Self-Service-Ticketportal für Endkunden

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) |
| Sprache | TypeScript |
| Datenbank | PostgreSQL 16 |
| ORM | Prisma |
| Auth | Auth.js (NextAuth v5) |
| Dateiablage | MinIO (S3-kompatibel) oder lokales Volume |
| Container | Docker / GHCR |
| CI/CD | GitHub Actions |

## Schnellstart mit Docker Compose

### Voraussetzungen

- Docker ≥ 24
- Docker Compose ≥ 2.20

### 1. Repository klonen

```bash
git clone https://github.com/ostsee-developer/ticketschmiede.git
cd ticketschmiede
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Pflichtfelder in `.env` anpassen:

```env
POSTGRES_PASSWORD=sicheres_passwort
AUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=Sicheres_Passwort_123!
NEXT_PUBLIC_APP_URL=https://ihre-domain.de
```

### 3. GHCR-Image authentifizieren (nur bei privaten Paketen)

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
```

### 4. Starten

```bash
docker compose up -d
```

Die Anwendung ist danach unter `http://localhost:3000` erreichbar.  
Beim ersten Start werden Datenbankmigrationen und der Seed-Admin automatisch eingespielt.

### Container-Images

Die Images werden per GitHub Actions gebaut und in der GitHub Container Registry veröffentlicht:

```
ghcr.io/ostsee-developer/ticketschmiede:latest   # main-Branch
ghcr.io/ostsee-developer/ticketschmiede:main
ghcr.io/ostsee-developer/ticketschmiede:develop
ghcr.io/ostsee-developer/ticketschmiede:1.2.3    # Semver-Tag
ghcr.io/ostsee-developer/ticketschmiede:sha-abc1234
```

Image manuell aktualisieren:

```bash
docker compose pull && docker compose up -d
```

## Entwicklungsumgebung

```bash
# Nur Datenbank starten
docker compose -f docker-compose.dev.yml up postgres -d

# Abhängigkeiten installieren
npm install

# Prisma-Client generieren & Migrationen einpielen
npx prisma generate
npx prisma migrate dev

# Entwicklungsserver starten
npm run dev
```

Alternativ vollständig per Docker:

```bash
docker compose -f docker-compose.dev.yml up
```

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ja | PostgreSQL-Verbindungs-URL |
| `POSTGRES_PASSWORD` | ja | Passwort für den DB-Container |
| `AUTH_SECRET` | ja | NextAuth-Secret (mind. 32 Zeichen) |
| `ENCRYPTION_KEY` | ja | AES-256-Key als 64-stelliger Hex-String |
| `SEED_ADMIN_EMAIL` | ja | E-Mail des ersten Admin-Nutzers |
| `SEED_ADMIN_PASSWORD` | ja | Passwort des ersten Admin-Nutzers |
| `NEXT_PUBLIC_APP_URL` | ja | Öffentliche URL der Anwendung |
| `S3_ENDPOINT` | nein | MinIO/S3-Endpunkt (Standard: MinIO-Dienst) |
| `S3_ACCESS_KEY` | nein | S3 Access Key |
| `S3_SECRET_KEY` | nein | S3 Secret Key |
| `S3_BUCKET` | nein | S3 Bucket-Name |
| `SESSION_DURATION` | nein | Session-Dauer in Sekunden (Standard: 28800) |
| `MAX_LOGIN_ATTEMPTS` | nein | Max. Fehlversuche vor Sperrung (Standard: 5) |
| `LOCKOUT_DURATION` | nein | Sperrdauer in Minuten (Standard: 15) |
| `AUDIT_LOG_RETENTION_DAYS` | nein | Aufbewahrungsdauer Audit-Log in Tagen (Standard: 365) |

Alle verfügbaren Variablen mit Beschreibungen sind in `.env.example` dokumentiert.

## CI/CD

```
Push auf main / develop
       │
       ▼
  Lint & Type-Check
       │
       ▼
  Build & Migration (PostgreSQL Service)
       │
       ▼
  Docker Build → Push zu GHCR (linux/amd64 + linux/arm64)
       │
       ▼
  Trivy Security Scan → GitHub Security Tab
```

Semver-Tags (`v1.2.3`) erzeugen zusätzlich versionierte Images.

## Datenbankmigrationen

Migrationen laufen beim Container-Start automatisch (`prisma migrate deploy`).  
Für manuelle Ausführung:

```bash
docker compose exec app npx prisma migrate deploy
```

## Sicherheitshinweise

- Den Port 5432 (PostgreSQL) niemals öffentlich exponieren — er ist in der Produktionskonfiguration auskommentiert.
- `AUTH_SECRET` und `ENCRYPTION_KEY` müssen kryptografisch zufällig generiert werden (siehe Kommentare in `.env.example`).
- Den MinIO-Konsolen-Port (9001) nur lokal binden oder hinter einem Reverse-Proxy absichern.
- Das `.env`-File niemals in die Versionskontrolle einchecken (`.gitignore` schützt es standardmäßig).

## Lizenz

Proprietär — alle Rechte vorbehalten.
