# Time Tracking – Marcación de acceso

Aplicación Next.js + Prisma para el control de acceso de colaboradores.

## Resumen de cambios recientes (feb 2026)

- Eliminado por ahora el modelo y la dependencia de "kiosks" (dispositivos): ya no existe `KioskDevice` ni se requiere `kiosk_id`/`kiosk_secret` en las peticiones de marcación. (Migración: `20260220212223_remove_kiosk_model_and_field`)
- En la pantalla pública (kiosko) las entradas por DNI y PIN sólo pueden introducirse mediante el teclado en pantalla (NumericKeypad). El teclado físico y el pegado están bloqueados para evitar entradas externas.
- En el panel administrativo (crear/editar colaborador) se mantiene la UI mejorada y el NumericKeypad fue removido: los administradores pueden usar el teclado físico normalmente para DNI y PIN.
- El endpoint `/api/access` valida PIN y registra accesos como antes, pero ya no requiere credenciales de kiosko. Se sigue registrando metadata (IP, fingerprint, selfie opcional, flags de sospecha).

> Nota de seguridad: eliminar la autenticación por dispositivo reduce una capa de protección. Si este repositorio se despliega en producción, considera introducir otro mecanismo de autorización de kioskos (device tokens, VPN, o modo kiosk solo en redes internas).

## Funcionalidades principales

- Marcación por `DNI + PIN` y `QR + PIN` (modo público)
- PIN hasheado (`bcryptjs`) y QR token por colaborador
- Regeneración de QR desde el panel de colaboradores (admin)
- Selfie opcional en marcación (subida si está configurado el storage)
- Registro de metadata: IP, device fingerprint, foto, flags de sospecha

## Requisitos

- Node 18+
- PNPM
- PostgreSQL

## Variables de entorno

Copia `.env.example` a `.env` y completa valores:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `BLOB_READ_WRITE_TOKEN` (opcional, para selfies)

## Arranque local (desarrollo)

```bash
pnpm install
# Si estás en desarrollo y quieres aplicar migraciones locales:
pnpm prisma migrate dev
# (opcional) poblar datos de ejemplo
pnpm prisma db seed
pnpm dev
```

Abrir en navegador:

- Kiosko público: `http://localhost:3000`
- Login admin: `http://localhost:3000/auth/signin`

## Notas de uso relevantes

- Pantalla pública (`/`): al usar `DNI + PIN` o `QR + PIN`, el campo DNI y el campo PIN se deben completar únicamente con el teclado en pantalla. Esto evita que se registren entradas desde teclados externos en un kiosko público.
- Panel administrativo (`/empleados`): el formulario para crear/editar colaboradores permite entrada de teclado físico normalmente; el NumericKeypad se eliminó de esta vista porque no corresponde al modo administrador.
- API `/api/access`: ya no requiere `kiosk_id`/`kiosk_secret`. Los campos esperados son `{ method, dni|qr_token, pin, device_fingerprint?, selfie_data_url? }`.

## Migraciones y generación de cliente Prisma

- Si traes los cambios a una copia local, aplica las migraciones y regenera el cliente Prisma:

```bash
pnpm prisma migrate deploy    # en producción
pnpm prisma migrate dev       # en desarrollo
pnpm prisma generate
```

## Comprobación rápida

```bash
pnpm lint
pnpm prisma migrate status
```

## Changelog

Consulta `CHANGELOG.md` para una lista detallada de cambios recientes.
