# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server with HMR (tsx server.ts + Vite middleware)
npm run build      # Production build via Vite
npm run preview    # Serve production build locally
npm run clean      # Remove dist/
npm run lint       # TypeScript type check (tsc --noEmit) — no test runner configured
```

## Architecture

**StockQuote** is a Japanese business app for product inventory and quote/estimate management.

### Stack

- **React 19** + **React Router 7** + **TypeScript 5**
- **Tailwind CSS 4** (dark mode via `ThemeContext`)
- **Firebase Firestore** (direct client SDK — no REST API; auth disabled, rules set `isAuthenticated() = true`)
- **React Hook Form** + **Zod 4** (form state + validation; all messages in Japanese)
- **Express** server (`server.ts`) — serves Vite middleware in dev, static `dist/` in production

### Domain Structure

Two main domains under `src/pages/`:

| Domain | Purpose |
|--------|---------|
| `products/` | Product inventory CRUD (name, code, manufacturer, price, stock, unit, tags) |
| `quotes/` | Quote creation by selecting products; auto-numbering, tax calc, PDF/Excel export |

### Data Flow

```
React Form → Zod validation → Firestore SDK (client-side CRUD)
                                    ↓
                        onSnapshot listener → component state → UI
```

- All Firestore operations happen client-side; `server.ts` only exposes `/api/health`
- Real-time updates use `onSnapshot` subscriptions

### Key Utilities (`src/lib/`)

- `quoteCalculations.ts` — tax (10%) and total computation
- `quoteNumber.ts` — auto-increment quote numbering
- `validations.ts` — Zod schemas for products and quotes
- `csv.ts` — CSV import/export via PapaParse; batch writes use 490-doc chunks (Firestore limit is 500)

### Export Pipeline

Client-side only:
- **PDF**: `dom-to-image-more` → `jsPDF` (preserves Japanese font rendering)
- **Excel**: `ExcelJS` + `file-saver`

### Firestore Collections

`products`, `quotes`, `tags` — schema documented in `firebase-blueprint.json`; security rules in `firestore.rules`.

### Config & Constants

`src/config/constants.ts` — `TAX_RATE`, `ITEMS_PER_PAGE` (10), `BATCH_COMMIT_SIZE` (490)

### Deployment

GitHub Actions (`.github/workflows/pages.yml`) builds and deploys to GitHub Pages on push to `main`. Base path is `/StockQuote/` in CI, `/` locally — Vite config handles this automatically.
