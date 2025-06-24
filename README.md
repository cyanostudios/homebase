# Homebase Monorepo

This repository contains the core applications and packages for the **Homebase** platform. It is managed as a Turborepo with the following structure:

- **apps** – runnable applications
  - `web` – React frontend (Vite based)
  - `api` – Fastify backend
  - `microapps/invoice` – placeholder microapp
- **packages** – shared libraries
  - `ui` – shared UI components
  - `auth` – authentication utilities
  - `core` – common business logic
  - `db` – database adapter (Postgres)
  - `i18n` – internationalization helpers

The repository currently contains only scaffolding to support future development.
