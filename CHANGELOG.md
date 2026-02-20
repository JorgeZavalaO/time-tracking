# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

- UI: Public kiosk page — DNI and PIN are editable only via on-screen numeric keypad; physical keyboard input and paste are blocked on the public kiosk to prevent external injection.
- UI: Admin collaborator form — removed NumericKeypad; DNI and PIN accept keyboard input normally. Improved form UX and simplified footer.
- API: `/api/access` no longer requires kiosk credentials (`kiosk_id` / `kiosk_secret`). Requests should send `{ method, dni|qr_token, pin, device_fingerprint?, selfie_data_url? }`.
- DB: Removed `KioskDevice` model and `kioskId` relation from `Access`. Migration created: `20260220212223_remove_kiosk_model_and_field`.
- Misc: Removed kiosk management components and API routes; updated seed and admin pages to reflect kioskless flow.
- Build: Fixed hydration mismatch warnings by marking body with `suppressHydrationWarning` to avoid noisy dev-time warnings when browser extensions mutate SSR HTML.

## [2026-02-20] - Removed kiosk model and keypad behaviour

- Implemented the changes above and applied the DB migration.
- Notes: This reduces a layer of device-level authorization. Consider reintroducing device tokens or network-level protections for production deployments.


