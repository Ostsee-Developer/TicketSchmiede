# Ticket Schmiede Deployment Notes

## Host-Verzeichnis für Backups vorbereiten

Die App läuft im Produktionscontainer als UID/GID `1000:1000`. Der Backup-Bind-Mount muss deshalb auf dem Host beschreibbar sein:

```bash
sudo BACKUP_DIR=/opt/backup/ticket-schmiede ./scripts/prepare-host-volumes.sh
```

Oder manuell:

```bash
sudo mkdir -p /opt/backup/ticket-schmiede
sudo chown -R 1000:1000 /opt/backup/ticket-schmiede
sudo chmod -R 750 /opt/backup/ticket-schmiede
```

## Avatar-/Upload-Auslieferung

`/api/uploads/...` ist in der Middleware als öffentlicher Pfad freigegeben, damit der Next.js Image Optimizer Avatar-Dateien abrufen kann. Die Route liefert jetzt auch bei `HEAD`-Requests gültige `Content-Type`- und `Content-Length`-Header.

## Backups

Das Produktionsimage enthält jetzt `postgresql-client`, damit `pg_dump` für echte Datenbank-Dumps verfügbar ist. Zusätzlich wird `BACKUP_DIR=/app/backups` gesetzt und über Docker Compose nach `/opt/backup/ticket-schmiede` gemountet.
