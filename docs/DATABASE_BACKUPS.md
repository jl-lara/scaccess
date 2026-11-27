# Respaldos de Base de Datos (Supabase Free Tier)

El plan gratuito (*Free Tier*) de Supabase no incluye respaldos automáticos diarios ni recuperación puntual (*PITR*). Para garantizar la continuidad operativa de **Accesa** con costo **\$0 USD**, el proyecto implementa respaldos lógicos automatizados mediante **GitHub Actions + `pg_dump` v17** y respaldo local bajo demanda.

---

## Arquitectura de respaldo

1. **Disparo automático diario:** El workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml) se ejecuta todos los días a las **09:00 UTC** (01:00 AM – 02:00 AM hora `America/Tijuana`) y también puede lanzarse manualmente desde la pestaña **Actions → Database Backup → Run workflow**.
2. **Conexión compatible con IPv4:** Los runners estándar de GitHub Actions (`ubuntu-latest`) solo tienen conectividad IPv4, mientras que la conexión directa de Supabase Free (`db.<ref>.supabase.co`) es solo IPv6. Por ello se utiliza la cadena **Session Mode Pooler** (puerto `5432`, host `aws-0-<region>.pooler.supabase.com`), que soporta IPv4 y sesiones completas requeridas por `pg_dump`.
3. **Motor coincidente (PostgreSQL 17):** El job instala `postgresql-client-17` para empatar exactamente con PostgreSQL 17 de Supabase.
4. **Verificación automática:** Cada corrida valida con `pg_restore --list` que el archivo `.dump` sea legible, no esté vacío y contenga las tablas críticas (`employees`, `credentials`, `areas`, `access_permissions`, `access_events`, `access_devices`), generando además su checksum `.sha256`.
5. **Almacenamiento privado (\$0 USD):**
   - **Predeterminado:** El archivo comprimido (y opcionalmente cifrado con AES-256-CBC) se guarda como **GitHub Actions Artifact** privado con retención configurable de **14 a 90 días**.
   - **Opcional externo (Cloudflare R2 / S3):** Si configuras los secretos `BACKUP_S3_*`, se sube una copia adicional a un bucket compatible con S3 (Cloudflare R2 ofrece **10 GB gratuitos** sin límite de 90 días).

---

## Configuración en GitHub (una sola vez)

### 1. Obtener la URL del Session Mode Pooler en Supabase

1. Abre tu proyecto en **Supabase Dashboard → Connect** (botón superior).
2. Selecciona **Method: Session pooler** (puerto **`5432`**, **NO** uses *Transaction pooler* `:6543` ni *Direct connection*).
3. Copia la URI (ejemplo):
   ```text
   postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```

### 2. Registrar secretos en GitHub

Ve a tu repositorio en **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Obligatorio | Descripción |
| :--- | :---: | :--- |
| `SUPABASE_DB_BACKUP_URL` | Sí | URI de **Session Mode Pooler** (`:5432`) con la contraseña real de Postgres. |
| `BACKUP_ENCRYPTION_KEY` | Recomendado | Frase secreta larga para cifrar el `.dump` con `AES-256-CBC` (`PBKDF2`) antes de subirlo. |
| `BACKUP_S3_BUCKET` | Opcional | Nombre del bucket R2/S3 (si desean retención externa > 90 días). |
| `BACKUP_S3_ENDPOINT` | Opcional | Endpoint S3 (ej. `https://<account_id>.r2.cloudflarestorage.com`). |
| `BACKUP_S3_ACCESS_KEY_ID` | Opcional | Access Key ID del bucket. |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Opcional | Secret Access Key del bucket. |

> **Importante:** Nunca guardes cadenas de conexión ni llaves de cifrado en archivos del repositorio. Todos los archivos en `backups/` están excluidos en `.gitignore`.

> **Formato requerido:** El usuario del Session Pooler debe ser `postgres.<project-ref>` y la contraseña debe ser la contraseña actual de Postgres. URL-encode los caracteres especiales de la contraseña al copiar la cadena de conexión. El puerto debe ser `5432`; el puerto `6543` corresponde al Transaction Pooler y no es compatible con `pg_dump`.

---

## Respaldo manual desde tu equipo

Si tienes instalado `pg_dump` / `pg_restore` (PostgreSQL 17) localmente y tu `.env` raíz tiene `SUPABASE_DB_BACKUP_URL`, `DIRECT_URL` o `DATABASE_URL`:

```bash
npm run db:backup
```

El script [`scripts/backup-db.mjs`](../scripts/backup-db.mjs) genera el archivo en `backups/scaccess-<UTC>.dump`, verifica las tablas críticas con `pg_restore --list` y escribe el checksum `.sha256`.

---

## Procedimiento de restauración (Runbook)

### 1. Descargar y verificar integridad

1. Descarga el artifact `scaccess-db-backup-<timestamp>` desde **GitHub Actions → Database Backup**.
2. Verifica el hash SHA-256:
   ```bash
   sha256sum -c scaccess-20261123T090000Z.dump.sha256
   ```
3. Si activaste `BACKUP_ENCRYPTION_KEY`, descifra el archivo primero:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
     -in scaccess-20261123T090000Z.dump.enc \
     -out scaccess-20261123T090000Z.dump
   ```

### 2. Restaurar sobre una instancia destino

> **Recomendación:** Antes de restaurar en producción, prueba primero en un proyecto Supabase de pruebas o PostgreSQL local (`docker` / Postgres 17).

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$TARGET_DB_URL" \
  scaccess-20261123T090000Z.dump
```

### 3. Verificación posterior a la restauración

1. Comprueba conteos en las tablas principales (`employees`, `credentials`, `areas`, `access_permissions`, `access_events`, `access_devices`, `user_accounts`, `roles`).
2. Confirma que RLS siga habilitado en las 13 tablas de `public` (`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`).
3. **Nota sobre Supabase Auth (`auth.users`):** El respaldo cubre el esquema `public`. Si restauras en un proyecto de Supabase **completamente nuevo**, los UUIDs de `auth.users` deben coincidir con `user_accounts.auth_user_id` o bien actualizarse por correo electrónico tras crear los usuarios en Supabase Auth:
   ```sql
   UPDATE public.user_accounts ua
   SET auth_user_id = au.id
   FROM auth.users au
   WHERE lower(ua.email) = lower(au.email);
   ```

Se recomienda realizar un **simulacro mensual de restauración** en una base de pruebas para validar que los respaldos son recuperables de punta a punta.
