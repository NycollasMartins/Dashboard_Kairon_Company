<<<<<<< HEAD
# Kairon Dashboard

Internal company dashboard built with React + Vite, backed by **Supabase** (Postgres + Auth).

## Prerequisites

1. Clone the repository and navigate to the project directory.
2. Install dependencies: `npm install`
3. Create a **`.env.local`** file at the project root (never commit this file):

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Both values are found in the Supabase dashboard under **Project Settings → API**.

4. Run the schema: open `supabase/schema.sql` and execute it in the **Supabase SQL Editor** (one-time setup).
5. After your first sign-up, promote your account to admin:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'seu@email.com';
```

## Running locally

```bash
npm run dev
```

The app will be available at http://localhost:5173.

## Other scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
=======
# Dashboard_Kairon_Company
Dashboard da Kairon Company
>>>>>>> origin/main
