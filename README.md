# Referee Admin

Referee Admin is a full-stack system for sports clubs to manage referee assignments, matches, and related administration. It combines a React client, an Express server, and a PostgreSQL database.

## Installation

Install all dependencies:

```bash
npm install
```

## Development

Run the development server with hot reload:

```bash
npm run dev
```

## Production Build

Create a production build and start the server:

```bash
npm run build
npm start
```

## Environment Variables

The backend requires database configuration through environment variables. Ensure `DATABASE_URL` (or `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and `PGPORT`) are set before running the app.

## More Documentation

See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) for project conventions and [replit.md](replit.md) for architecture details.
