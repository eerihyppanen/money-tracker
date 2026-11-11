# Money left over

A personal tracker for recurring expenses and income. It runs as an installable PWA and keeps all data on the device (IndexedDB).

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm test` | Run the unit tests (Vitest) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |

## Structure

- `src/domain/`: pure logic with no React or storage. `schedule.ts` handles monthly equivalents, due dates and charges per month; `format.ts` handles Finnish money and date formatting. Both are unit-tested.
- `src/data/`: the `Repository` interface and its Dexie (IndexedDB) implementation. To change the storage backend, change `src/data/index.ts`.
- `src/ui/`: layout, pages and components.

## Date rules

- Dates are stored as `YYYY-MM-DD` strings.
- Month-based entries keep their original day: a monthly entry on the 31st is charged on Feb 28/29 and goes back to the 31st in March.
- A due date that has passed moves forward automatically when the app opens or comes back to the foreground.
