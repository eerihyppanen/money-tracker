# Money left over

A personal tracker for recurring expenses and income. It's an installable PWA that works offline and keeps all data on the device (IndexedDB).

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm test` | Run the unit tests (Vitest) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build, service worker included |
| `npx pwa-assets-generator` | Regenerate the app icons from `public/logo.svg` |

## Structure

- `src/domain/`: pure logic with no React or storage, all unit-tested.
  - `schedule.ts`: monthly equivalents, due dates, charges per month
  - `format.ts`: Finnish money and date formatting
  - `entryForm.ts`, `listing.ts`: form conversion and list filtering
  - `backup.ts`: JSON backups, CSV export, category names
- `src/data/`: the `Repository` interface and its Dexie (IndexedDB) implementation. To change the storage backend, change `src/data/index.ts`.
- `src/ui/`: layout, pages and components.

## Date rules

- Dates are stored as `YYYY-MM-DD` strings.
- Month-based entries keep their original day: a monthly entry on the 31st is charged on Feb 28/29 and goes back to the 31st in March.
- A due date that has passed moves forward automatically when the app opens or comes back to the foreground.

## Backups

All data lives in the browser on one device. Settings → **Save backup** downloads a JSON file. **Restore from backup** on another device replaces everything there with that file's contents. **Export CSV** is for spreadsheets only; it uses `;` separators and decimal commas so Finnish Excel reads it correctly.

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and publishes the app on every push to `master`/`main`. One-time setup:

1. Push the repository to GitHub.
2. In the repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Open `https://<your-user>.github.io/<repo>/` on your phone. Then:
   - **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
   - **iPhone (Safari):** Share → *Add to Home Screen*.

The site's code is public, but your data never leaves your device.
