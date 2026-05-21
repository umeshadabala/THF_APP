# The Homely Food (THF)

A lightweight **Progressive Web App** for managing a cloud kitchen: orders, inventory, and spending — synced to **Supabase**.

## Project structure

```
THF_APP/
├── index.html          # App shell (views, nav, modals)
├── app.js              # UI logic, menu, Supabase CRUD
├── config.js           # Supabase URL + anon key (local only, gitignored)
├── config.example.js   # Template for config.js
├── style.css           # Glassmorphism UI styles
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline cache)
├── icons/              # PWA icons (192, 512)
├── supabase/
│   └── schema.sql      # Database tables + RLS policies
├── package.json        # npm deps + dev server script
└── .agents/skills/     # Cursor agent skills (Supabase)
```

## Features

| View        | Purpose                                      |
|-------------|----------------------------------------------|
| **Home**    | Daily/total orders & revenue, recent activity |
| **Orders**  | Full order list, mark delivered, delete       |
| **Stock**   | Inventory quantities (+/−, add/delete)        |
| **Spend**   | Expense tracker by category                   |

Write actions (new order, stock change, expenses, deletes) require the **admin password** defined in `app.js`.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

```bash
cp config.example.js config.js
```

Edit `config.js` with your project URL and **anon/public** key from  
[Supabase Dashboard](https://supabase.com/dashboard) → **Project Settings** → **API**.

### 3. Database (new Supabase project only)

If tables do not exist yet, run `supabase/schema.sql` in the Supabase **SQL Editor**.

The live project already has `orders`, `inventory`, and `spending` tables.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The app loads Supabase from CDN in `index.html`. The `@supabase/supabase-js` npm package is available for future tooling.

## Tech stack

- Vanilla HTML / CSS / JavaScript (no build step)
- [Supabase](https://supabase.com) (Postgres + REST API)
- PWA: `manifest.json` + service worker

## Security notes

- **Never commit** `config.js` — it contains your anon key.
- Admin access is a **client-side password** (`THF@123` in `app.js`). For production, use Supabase Auth + RLS instead of open anon policies.
- Rotate keys if `config.js` was ever pushed to a public repo.

## License

See [LICENSE](LICENSE).
