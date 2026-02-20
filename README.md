# Time Tracking – Kiosko de Marcación

Aplicación Next.js + Prisma para control de acceso de colaboradores.

## Funcionalidades implementadas

- Marcación A/B en kiosko:
	- `DNI + PIN`
	- `QR + PIN` (escáner cámara + fallback manual)
- Kiosko autorizado por dispositivo (`kiosk_id` + `kiosk_secret`)
- PIN hasheado (`bcryptjs`) y QR token por colaborador
- Regeneración de QR desde panel de colaboradores
- Marcación con metadata: IP, fingerprint de dispositivo, kiosk
- Selfie opcional en marcación (subida a Blob si está configurado)
- Flags básicos anti-suplantación (`confidence_flag`, `suspicious_reason`)

## Requisitos

- Node 18+
- PNPM
- Base de datos PostgreSQL

## Variables de entorno

Copia `.env.example` a `.env` y completa valores:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `BLOB_READ_WRITE_TOKEN` (opcional, para selfies)

## Arranque local

```bash
pnpm install
pnpm prisma migrate reset
pnpm prisma db seed
pnpm dev
```

Abrir en navegador:

- Kiosko público: `http://localhost:3000`
- Login admin: `http://localhost:3000/auth/signin`

## Registro de kiosko (admin)

1. Crear dispositivo en `POST /api/kiosks` (requiere sesión admin).
2. Guardar `id` y `secret` devuelto (el secret se muestra una sola vez).
3. En pantalla kiosko (`/`) ingresar `Kiosk ID` y `Kiosk Secret`.

## Comprobación rápida

```bash
pnpm lint
pnpm prisma migrate status
```
