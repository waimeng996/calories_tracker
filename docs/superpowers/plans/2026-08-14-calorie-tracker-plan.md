# Calorie + Insulin Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user PWA that lets a Type 1 diabetic log meals via photo (AI-analyzed for calories/carbs/protein/fat) and insulin units, tracks daily remaining calories/macros against a safe, calculated goal.

**Architecture:** Next.js 14 (App Router, TypeScript) deployed on Netlify. Supabase provides auth (single user), Postgres (profile/meal/insulin tables), and photo storage. A Next.js server-side API route proxies food-photo analysis to the Gemini API so the key never reaches the browser. Pure calculation logic (TDEE/macros/goal-safety, Gemini response parsing) is isolated into small modules and covered by unit tests; UI/integration flows are verified manually per the spec's testing section.

**Tech Stack:** Next.js 14 + TypeScript, Tailwind CSS, @supabase/supabase-js + @supabase/ssr, @google/generative-ai, Vitest (unit tests), Netlify (`@netlify/plugin-nextjs`), no PWA library — hand-written manifest + minimal service worker.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-14-calorie-tracker-design.md` — every task below implements a section of it.
- Single user only — no signup UI, no multi-tenant logic.
- Insulin logging is record-only — never compute or suggest a dose.
- Gemini key and Supabase service-role key must only ever be read server-side (`process.env` in API routes / server components), never sent to the client.
- Money/measurement units: calories in kcal, macros in grams, insulin in units (numeric).
- All DB tables use Row Level Security scoped to `auth.uid()` — no table is publicly readable.

---

## File Structure

```
calories-tracker/
  package.json
  tsconfig.json
  next.config.mjs
  tailwind.config.ts
  netlify.toml
  .env.local.example
  middleware.ts
  vitest.config.ts
  app/
    layout.tsx
    globals.css
    login/page.tsx
    onboarding/page.tsx
    (app)/
      layout.tsx           # auth-gated shell (nav)
      page.tsx              # dashboard
      log/page.tsx           # record a meal
      insulin/page.tsx       # quick insulin log
      history/page.tsx       # past days
    api/
      analyze-food/route.ts
  components/
    PhotoCapture.tsx
    DailyRing.tsx
  lib/
    nutrition.ts             # BMR/TDEE/macros/goal-safety (pure)
    nutrition.test.ts
    gemini.ts                # prompt build + response parse (pure) + callGemini (I/O)
    gemini.test.ts
    image.ts                 # canvas-based client-side compression (pure-ish, DOM)
    supabase/client.ts        # browser client
    supabase/server.ts        # server client (cookies-based session)
  supabase/
    migrations/
      0001_init.sql
    functions/
      cleanup-old-photos/index.ts
  public/
    manifest.json
    sw.js
    icon-192.png
    icon-512.png
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.local.example`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (temporary placeholder, replaced in Task 10), `vitest.config.ts`

**Interfaces:**
- Produces: a runnable `npm run dev` Next.js app on port 3000, `npm test` running Vitest, Tailwind available to all components via `globals.css`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "calorie-tracker",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "@google/generative-ai": "^0.19.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 5: Create Tailwind config**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`postcss.config.mjs`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calorie Tracker',
  description: 'Personal calorie and insulin tracker',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create placeholder `app/page.tsx`** (replaced by dashboard in Task 10)

```tsx
export default function Home() {
  return <main className="p-6">Calorie Tracker — under construction</main>;
}
```

- [ ] **Step 9: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node' },
});
```

- [ ] **Step 10: Create `.gitignore`**

```
node_modules/
.next/
.env.local
.env
*.log
```

- [ ] **Step 11: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

- [ ] **Step 12: Verify it runs**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`, page shows "Calorie Tracker — under construction". Stop the server after confirming.

- [ ] **Step 13: Commit**

```bash
git add package.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts .gitignore .env.local.example app/layout.tsx app/globals.css app/page.tsx package-lock.json
git commit -m "chore: scaffold Next.js + Tailwind + Vitest project"
```

---

### Task 2: Supabase schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `public.profiles`, `public.meal_logs`, `public.insulin_logs` with columns used verbatim by every later task (Task 6, 8, 9, 10, 11, 13). Storage bucket `meal-photos`.

- [ ] **Step 1: Write the migration**

```sql
-- 0001_init.sql

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age integer not null,
  weight_kg numeric not null,
  height_cm numeric not null,
  sex text not null check (sex in ('male','female')),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null check (goal in ('lose','maintain','gain')),
  target_weight_kg numeric,
  target_date date,
  daily_calories numeric not null,
  daily_carbs_g numeric not null,
  daily_protein_g numeric not null,
  daily_fat_g numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  photo_url text,
  user_note text,
  ai_raw_description text,
  calories numeric not null,
  carbs_g numeric not null,
  protein_g numeric not null,
  fat_g numeric not null,
  created_at timestamptz not null default now()
);

alter table public.meal_logs enable row level security;

create policy "meal_logs_owner_all" on public.meal_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index meal_logs_user_logged_at_idx on public.meal_logs (user_id, logged_at desc);

create table public.insulin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  units numeric not null,
  meal_log_id uuid references public.meal_logs(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.insulin_logs enable row level security;

create policy "insulin_logs_owner_all" on public.insulin_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index insulin_logs_user_logged_at_idx on public.insulin_logs (user_id, logged_at desc);

-- Storage bucket for meal photos, private, path convention: {user_id}/{meal_log_id}.jpg
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false)
  on conflict (id) do nothing;

create policy "meal_photos_owner_select" on storage.objects
  for select using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "meal_photos_owner_insert" on storage.objects
  for insert with check (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "meal_photos_owner_delete" on storage.objects
  for delete using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 2: Apply the migration**

In the Supabase project dashboard → SQL Editor, paste the contents of `supabase/migrations/0001_init.sql` and run it.
Expected: "Success. No rows returned."

- [ ] **Step 3: Verify tables and policies exist**

In SQL Editor run:
```sql
select table_name from information_schema.tables where table_schema = 'public';
select policyname from pg_policies where schemaname = 'public';
```
Expected: `profiles`, `meal_logs`, `insulin_logs` listed; 5 policy names listed (3 table `_owner_all` + storage select/insert/delete... note storage policies are in `storage` schema, so a second query `select policyname from pg_policies where schemaname = 'storage'` should show the 3 `meal_photos_*` policies).

- [ ] **Step 4: Create the single user account**

In Supabase dashboard → Authentication → Users → Add user, create the one account with your email + a password. Note the email for `.env.local` reference is not needed — login page will just prompt for it.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add Supabase schema, RLS policies, and meal-photos bucket"
```

---

### Task 3: Supabase clients + auth middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`

**Interfaces:**
- Produces: `createBrowserSupabase()` (browser client, used by client components in Task 4, 6, 8, 9, 10, 11), `createServerSupabase()` (server client for server components/route handlers, used by Task 6, 7, 10, 11), `middleware` that redirects unauthenticated requests to `/login` and refreshes session cookies.

- [ ] **Step 1: Create `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create `lib/supabase/server.ts`**

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create `middleware.ts`**

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*\\.png|api/analyze-food).*)'],
};
```

Note: `/api/analyze-food` is excluded from the redirect matcher because it does its own auth check via the server Supabase client in Task 7 and must return JSON (not a redirect) on failure.

- [ ] **Step 4: Add env vars**

Copy `.env.local.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase dashboard → Project Settings → API.

- [ ] **Step 5: Verify redirect behavior**

Run: `npm run dev`, visit `http://localhost:3000/` in a browser with no session.
Expected: redirected to `/login` (page doesn't exist yet — a 404 on `/login` is fine at this step, the redirect itself is what's being confirmed via the Network tab showing a 307 to `/login`).

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts middleware.ts .env.local.example
git commit -m "feat: add Supabase browser/server clients and auth middleware"
```

---

### Task 4: Login page

**Files:**
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabase()` from `lib/supabase/client.ts` (Task 3).
- Produces: working sign-in for the single pre-created user; on success, redirects to `/`.

- [ ] **Step 1: Create `app/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Log in</h1>
        <input
          type="email"
          required
          placeholder="Email"
          className="w-full rounded border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verify login works**

Run: `npm run dev`, visit `/login`, sign in with the account created in Task 2 Step 4.
Expected: redirected to `/` (shows the Task 1 placeholder page since dashboard isn't built yet).

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add login page"
```

---

### Task 5: Nutrition calculation library (TDD)

**Files:**
- Create: `lib/nutrition.ts`, `lib/nutrition.test.ts`

**Interfaces:**
- Produces (used by Task 6 onboarding):
  - `type Sex = 'male' | 'female'`
  - `type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'`
  - `type Goal = 'lose' | 'maintain' | 'gain'`
  - `interface ProfileInput { age: number; weightKg: number; heightCm: number; sex: Sex; activityLevel: ActivityLevel }`
  - `interface DailyTargets { calories: number; carbsG: number; proteinG: number; fatG: number }`
  - `calculateBMR(input: ProfileInput): number`
  - `calculateTDEE(input: ProfileInput): number`
  - `calculateDailyTargets(input: ProfileInput, dailyCalorieAdjustment: number): DailyTargets`
  - `interface GoalCheckInput { currentWeightKg: number; targetWeightKg: number; targetDate: string; today?: string }`
  - `interface GoalCheckResult { requestedWeeklyChangeKg: number; maxSafeWeeklyChangeKg: number; isSafe: boolean; suggestedTargetDate: string | null; safeDailyCalorieAdjustment: number }`
  - `checkGoalSafety(input: GoalCheckInput): GoalCheckResult`

- [ ] **Step 1: Write failing tests**

`lib/nutrition.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calculateBMR, calculateTDEE, calculateDailyTargets, checkGoalSafety } from './nutrition';

describe('calculateBMR', () => {
  it('computes Mifflin-St Jeor BMR for a male', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    const bmr = calculateBMR({ age: 30, weightKg: 70, heightCm: 175, sex: 'male', activityLevel: 'sedentary' });
    expect(bmr).toBeCloseTo(1648.75, 1);
  });

  it('computes Mifflin-St Jeor BMR for a female', () => {
    // BMR = 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    const bmr = calculateBMR({ age: 25, weightKg: 60, heightCm: 165, sex: 'female', activityLevel: 'sedentary' });
    expect(bmr).toBeCloseTo(1345.25, 1);
  });
});

describe('calculateTDEE', () => {
  it('multiplies BMR by the activity factor', () => {
    const input = { age: 30, weightKg: 70, heightCm: 175, sex: 'male' as const, activityLevel: 'moderate' as const };
    const bmr = calculateBMR(input);
    const tdee = calculateTDEE(input);
    expect(tdee).toBeCloseTo(bmr * 1.55, 1);
  });
});

describe('calculateDailyTargets', () => {
  it('splits calories into macros using fixed ratios', () => {
    const input = { age: 30, weightKg: 70, heightCm: 175, sex: 'male' as const, activityLevel: 'sedentary' as const };
    const targets = calculateDailyTargets(input, 0);
    const tdee = calculateTDEE(input);
    expect(targets.calories).toBeCloseTo(tdee, 0);
    // carbs 47.5% of calories / 4 kcal per g
    expect(targets.carbsG).toBeCloseTo((tdee * 0.475) / 4, 0);
    expect(targets.proteinG).toBeCloseTo((tdee * 0.225) / 4, 0);
    expect(targets.fatG).toBeCloseTo((tdee * 0.3) / 9, 0);
  });

  it('applies a negative calorie adjustment for weight loss', () => {
    const input = { age: 30, weightKg: 70, heightCm: 175, sex: 'male' as const, activityLevel: 'sedentary' as const };
    const tdee = calculateTDEE(input);
    const targets = calculateDailyTargets(input, -500);
    expect(targets.calories).toBeCloseTo(tdee - 500, 0);
  });

  it('never returns a calorie target below 1200', () => {
    const input = { age: 60, weightKg: 45, heightCm: 150, sex: 'female' as const, activityLevel: 'sedentary' as const };
    const targets = calculateDailyTargets(input, -2000);
    expect(targets.calories).toBeGreaterThanOrEqual(1200);
  });
});

describe('checkGoalSafety', () => {
  it('flags an unsafe fast weight-loss target', () => {
    // 20kg in 12 weeks = 1.667kg/week, max safe = min(1, 0.8*0.01) -> for 80kg current, 1% = 0.8kg, so cap 0.8
    const result = checkGoalSafety({
      currentWeightKg: 80,
      targetWeightKg: 60,
      targetDate: '2026-11-06', // ~12 weeks after today
      today: '2026-08-14',
    });
    expect(result.isSafe).toBe(false);
    expect(result.requestedWeeklyChangeKg).toBeCloseTo(1.667, 2);
    expect(result.maxSafeWeeklyChangeKg).toBeCloseTo(0.8, 2);
    expect(result.suggestedTargetDate).not.toBeNull();
    expect(result.safeDailyCalorieAdjustment).toBeLessThan(0);
  });

  it('accepts a safe, gradual weight-loss target', () => {
    const result = checkGoalSafety({
      currentWeightKg: 80,
      targetWeightKg: 76,
      targetDate: '2026-10-09', // 8 weeks, 0.5kg/week
      today: '2026-08-14',
    });
    expect(result.isSafe).toBe(true);
    expect(result.suggestedTargetDate).toBeNull();
  });

  it('handles weight gain the same way (positive direction)', () => {
    const result = checkGoalSafety({
      currentWeightKg: 60,
      targetWeightKg: 63,
      targetDate: '2026-09-11', // 4 weeks, 0.75kg/week, safe (max 1% of 60 = 0.6 -> unsafe actually)
      today: '2026-08-14',
    });
    expect(result.requestedWeeklyChangeKg).toBeGreaterThan(0);
    expect(result.maxSafeWeeklyChangeKg).toBeCloseTo(0.6, 2);
    expect(result.isSafe).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: FAIL — `lib/nutrition.ts` does not exist / exports not found.

- [ ] **Step 3: Implement `lib/nutrition.ts`**

```ts
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface ProfileInput {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  activityLevel: ActivityLevel;
}

export interface DailyTargets {
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Fixed macro split (midpoints of the 45-50 / 20-25 / 25-30 % ranges from the spec).
const CARB_RATIO = 0.475;
const PROTEIN_RATIO = 0.225;
const FAT_RATIO = 0.3;

const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;

const MIN_SAFE_CALORIES = 1200;

const KCAL_PER_KG_FAT = 7700;
const MAX_SAFE_WEEKLY_CHANGE_KG_ABS = 1;
const MAX_SAFE_WEEKLY_CHANGE_PCT = 0.01;

export function calculateBMR(input: ProfileInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(input: ProfileInput): number {
  return calculateBMR(input) * ACTIVITY_FACTORS[input.activityLevel];
}

export function calculateDailyTargets(input: ProfileInput, dailyCalorieAdjustment: number): DailyTargets {
  const rawCalories = calculateTDEE(input) + dailyCalorieAdjustment;
  const calories = Math.max(rawCalories, MIN_SAFE_CALORIES);
  return {
    calories: Math.round(calories),
    carbsG: Math.round((calories * CARB_RATIO) / KCAL_PER_G_CARB),
    proteinG: Math.round((calories * PROTEIN_RATIO) / KCAL_PER_G_PROTEIN),
    fatG: Math.round((calories * FAT_RATIO) / KCAL_PER_G_FAT),
  };
}

export interface GoalCheckInput {
  currentWeightKg: number;
  targetWeightKg: number;
  targetDate: string; // ISO date, e.g. '2026-11-06'
  today?: string; // ISO date, defaults to current date
}

export interface GoalCheckResult {
  requestedWeeklyChangeKg: number;
  maxSafeWeeklyChangeKg: number;
  isSafe: boolean;
  suggestedTargetDate: string | null;
  /** Daily calorie adjustment (negative for loss, positive for gain) to apply, using the safe rate when unsafe. */
  safeDailyCalorieAdjustment: number;
}

export function checkGoalSafety(input: GoalCheckInput): GoalCheckResult {
  const today = new Date(input.today ?? new Date().toISOString().slice(0, 10));
  const targetDate = new Date(input.targetDate);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max((targetDate.getTime() - today.getTime()) / msPerWeek, 1 / 7);

  const totalChangeKg = input.targetWeightKg - input.currentWeightKg;
  const requestedWeeklyChangeKg = totalChangeKg / weeks;

  const maxSafeWeeklyChangeKg = Math.min(
    MAX_SAFE_WEEKLY_CHANGE_KG_ABS,
    input.currentWeightKg * MAX_SAFE_WEEKLY_CHANGE_PCT
  );

  const isSafe = Math.abs(requestedWeeklyChangeKg) <= maxSafeWeeklyChangeKg;
  const direction = totalChangeKg >= 0 ? 1 : -1;
  const safeWeeklyChangeKg = direction * maxSafeWeeklyChangeKg;

  let suggestedTargetDate: string | null = null;
  if (!isSafe) {
    const safeWeeks = Math.abs(totalChangeKg) / maxSafeWeeklyChangeKg;
    const suggested = new Date(today.getTime() + safeWeeks * msPerWeek);
    suggestedTargetDate = suggested.toISOString().slice(0, 10);
  }

  const effectiveWeeklyChangeKg = isSafe ? requestedWeeklyChangeKg : safeWeeklyChangeKg;
  const safeDailyCalorieAdjustment = (effectiveWeeklyChangeKg * KCAL_PER_KG_FAT) / 7;

  return {
    requestedWeeklyChangeKg,
    maxSafeWeeklyChangeKg,
    isSafe,
    suggestedTargetDate,
    safeDailyCalorieAdjustment,
  };
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npm test`
Expected: PASS — all `nutrition.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/nutrition.ts lib/nutrition.test.ts
git commit -m "feat: add TDEE/macro/goal-safety calculation library with tests"
```

---

### Task 6: Onboarding page

**Files:**
- Create: `app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `calculateDailyTargets`, `checkGoalSafety`, `ProfileInput`, `Goal` from `lib/nutrition.ts` (Task 5); `createBrowserSupabase()` from `lib/supabase/client.ts` (Task 3).
- Produces: a row in `public.profiles` (Task 2 schema) with `daily_calories`/`daily_carbs_g`/`daily_protein_g`/`daily_fat_g` populated; redirects to `/` when done.

- [ ] **Step 1: Create `app/onboarding/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import {
  calculateDailyTargets,
  checkGoalSafety,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@/lib/nutrition';

export default function OnboardingPage() {
  const router = useRouter();
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<Sex>('female');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [acceptedOverride, setAcceptedOverride] = useState(false);
  const [dailyAdjustment, setDailyAdjustment] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const profileInput = {
    age: Number(age),
    weightKg: Number(weightKg),
    heightCm: Number(heightCm),
    sex,
    activityLevel,
  };

  function runSafetyCheck(): number {
    if (goal === 'maintain' || !targetWeightKg || !targetDate) {
      setSafetyWarning(null);
      return 0;
    }
    const result = checkGoalSafety({
      currentWeightKg: Number(weightKg),
      targetWeightKg: Number(targetWeightKg),
      targetDate,
    });
    if (!result.isSafe && !acceptedOverride) {
      setSafetyWarning(
        `呢个速度唔安全: 需要每周${result.requestedWeeklyChangeKg.toFixed(2)}kg, 建议上限每周${result.maxSafeWeeklyChangeKg.toFixed(2)}kg。` +
          `建议目标日期改做 ${result.suggestedTargetDate}, 或以安全速率继续。`
      );
    } else {
      setSafetyWarning(null);
    }
    return result.safeDailyCalorieAdjustment;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const adjustment = runSafetyCheck();
    if (safetyWarning && !acceptedOverride) {
      return; // block save until user accepts suggestion or overrides
    }

    setDailyAdjustment(adjustment);
    setSaving(true);

    const targets = calculateDailyTargets(profileInput, adjustment);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not logged in');
      setSaving(false);
      return;
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      age: profileInput.age,
      weight_kg: profileInput.weightKg,
      height_cm: profileInput.heightCm,
      sex: profileInput.sex,
      activity_level: profileInput.activityLevel,
      goal,
      target_weight_kg: goal === 'maintain' ? null : Number(targetWeightKg),
      target_date: goal === 'maintain' ? null : targetDate,
      daily_calories: targets.calories,
      daily_carbs_g: targets.carbsG,
      daily_protein_g: targets.proteinG,
      daily_fat_g: targets.fatG,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">Your profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="number" required placeholder="Age" className="w-full rounded border px-3 py-2" value={age} onChange={(e) => setAge(e.target.value)} />
        <input type="number" required placeholder="Weight (kg)" className="w-full rounded border px-3 py-2" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        <input type="number" required placeholder="Height (cm)" className="w-full rounded border px-3 py-2" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        <select className="w-full rounded border px-3 py-2" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
        <select className="w-full rounded border px-3 py-2" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}>
          <option value="sedentary">Sedentary</option>
          <option value="light">Lightly active</option>
          <option value="moderate">Moderately active</option>
          <option value="active">Active</option>
          <option value="very_active">Very active</option>
        </select>
        <select className="w-full rounded border px-3 py-2" value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
          <option value="maintain">Maintain weight</option>
          <option value="lose">Lose weight</option>
          <option value="gain">Gain weight</option>
        </select>
        {goal !== 'maintain' && (
          <>
            <input type="number" required placeholder="Target weight (kg)" className="w-full rounded border px-3 py-2" value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} />
            <input type="date" required className="w-full rounded border px-3 py-2" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </>
        )}
        {safetyWarning && (
          <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{safetyWarning}</p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={acceptedOverride} onChange={(e) => setAcceptedOverride(e.target.checked)} />
              我明白风险, 坚持原计划
            </label>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={runSafetyCheck}
          className="w-full rounded border border-gray-900 py-2"
        >
          检查目标
        </button>
        <button type="submit" disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, log in, visit `/onboarding`.
1. Fill in age 30 / weight 80 / height 170 / goal lose / target weight 60 / target date 12 weeks out → click "检查目标" → expect the amber safety warning to appear.
2. Check "我明白风险" → submit → expect redirect to `/`.
3. Confirm the row in Supabase dashboard → Table Editor → `profiles`: `daily_calories` etc. populated, `target_weight_kg`/`target_date` saved.
4. Repeat with goal maintain → confirm `target_weight_kg`/`target_date` are `null` and no safety prompt appears.

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: add onboarding page with goal safety check"
```

---

### Task 7: Gemini food analysis (TDD parser + API route)

**Files:**
- Create: `lib/gemini.ts`, `lib/gemini.test.ts`, `app/api/analyze-food/route.ts`

**Interfaces:**
- Produces:
  - `interface FoodAnalysis { description: string; calories: number; carbsG: number; proteinG: number; fatG: number }`
  - `buildPrompt(userNote: string | null): string`
  - `parseGeminiResponse(raw: string): FoodAnalysis` (throws `GeminiParseError` on malformed input)
  - `class GeminiParseError extends Error`
  - `analyzeFoodPhoto(imageBase64: string, mimeType: string, userNote: string | null): Promise<FoodAnalysis>` (I/O, calls the Gemini API — not unit tested, exercised via Step 6 manual curl)
  - `POST /api/analyze-food` — Next.js route consumed by Task 8's meal log page. Request: `multipart/form-data` with fields `photo` (File) and `note` (string, optional). Response: `200 { analysis: FoodAnalysis }` or `502 { error: string }`.

- [ ] **Step 1: Write failing tests for the pure parsing logic**

`lib/gemini.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseGeminiResponse, buildPrompt, GeminiParseError } from './gemini';

describe('buildPrompt', () => {
  it('includes the user note as extra context when provided', () => {
    const prompt = buildPrompt('light mayo, low fat milk');
    expect(prompt).toContain('light mayo, low fat milk');
  });

  it('omits note context when none is given', () => {
    const prompt = buildPrompt(null);
    expect(prompt).not.toContain('null');
  });
});

describe('parseGeminiResponse', () => {
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({
      description: 'Grilled chicken breast with rice and broccoli',
      calories: 520,
      carbsG: 55,
      proteinG: 40,
      fatG: 12,
    });
    const result = parseGeminiResponse(raw);
    expect(result).toEqual({
      description: 'Grilled chicken breast with rice and broccoli',
      calories: 520,
      carbsG: 55,
      proteinG: 40,
      fatG: 12,
    });
  });

  it('parses JSON wrapped in a markdown code fence', () => {
    const raw = '```json\n{"description":"Toast with butter","calories":250,"carbsG":30,"proteinG":5,"fatG":10}\n```';
    const result = parseGeminiResponse(raw);
    expect(result.calories).toBe(250);
  });

  it('throws GeminiParseError on non-JSON text', () => {
    expect(() => parseGeminiResponse('Sorry, I cannot analyze this image.')).toThrow(GeminiParseError);
  });

  it('throws GeminiParseError when a required field is missing', () => {
    const raw = JSON.stringify({ description: 'Salad', calories: 200, carbsG: 10 });
    expect(() => parseGeminiResponse(raw)).toThrow(GeminiParseError);
  });

  it('throws GeminiParseError when a numeric field is not a number', () => {
    const raw = JSON.stringify({ description: 'Salad', calories: 'a lot', carbsG: 10, proteinG: 5, fatG: 5 });
    expect(() => parseGeminiResponse(raw)).toThrow(GeminiParseError);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: FAIL — `lib/gemini.ts` does not exist.

- [ ] **Step 3: Implement `lib/gemini.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface FoodAnalysis {
  description: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export class GeminiParseError extends Error {}

export function buildPrompt(userNote: string | null): string {
  const base =
    'You are a nutrition estimation assistant. Look at the food in this photo and estimate its nutritional ' +
    'content. Respond with ONLY a JSON object (no markdown, no extra text) with exactly these fields: ' +
    '"description" (short string naming the food), "calories" (number, kcal), "carbsG" (number, grams), ' +
    '"proteinG" (number, grams), "fatG" (number, grams). Estimate for the entire visible portion.';
  if (userNote && userNote.trim().length > 0) {
    return `${base} The user provided this additional context about the ingredients used: "${userNote.trim()}". Use it to refine your estimate.`;
  }
  return base;
}

function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

export function parseGeminiResponse(raw: string): FoodAnalysis {
  const jsonText = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new GeminiParseError(`Gemini response was not valid JSON: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new GeminiParseError('Gemini response was not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;
  const requiredNumberFields = ['calories', 'carbsG', 'proteinG', 'fatG'] as const;
  for (const field of requiredNumberFields) {
    if (typeof obj[field] !== 'number' || Number.isNaN(obj[field])) {
      throw new GeminiParseError(`Gemini response missing or invalid numeric field "${field}"`);
    }
  }
  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    throw new GeminiParseError('Gemini response missing "description" string field');
  }

  return {
    description: obj.description as string,
    calories: obj.calories as number,
    carbsG: obj.carbsG as number,
    proteinG: obj.proteinG as number,
    fatG: obj.fatG as number,
  };
}

export async function analyzeFoodPhoto(
  imageBase64: string,
  mimeType: string,
  userNote: string | null
): Promise<FoodAnalysis> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent([
    buildPrompt(userNote),
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const text = result.response.text();
  return parseGeminiResponse(text);
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npm test`
Expected: PASS — all `gemini.test.ts` cases green.

- [ ] **Step 5: Implement the API route**

`app/api/analyze-food/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { analyzeFoodPhoto, GeminiParseError } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const photo = formData.get('photo');
  const note = formData.get('note');

  if (!(photo instanceof File)) {
    return NextResponse.json({ error: 'Missing photo' }, { status: 400 });
  }

  const arrayBuffer = await photo.arrayBuffer();
  const imageBase64 = Buffer.from(arrayBuffer).toString('base64');

  try {
    const analysis = await analyzeFoodPhoto(
      imageBase64,
      photo.type || 'image/jpeg',
      typeof note === 'string' ? note : null
    );
    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof GeminiParseError ? err.message : 'Food analysis failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 6: Manual verification against the real Gemini API**

Set `GEMINI_API_KEY` in `.env.local` (from Google AI Studio). Run `npm run dev`, log in in the browser first (route needs a session cookie), then in a second terminal:

```bash
curl -X POST http://localhost:3000/api/analyze-food \
  -H "Cookie: $(cat /tmp/session-cookie.txt)" \
  -F "photo=@/path/to/a/food/photo.jpg" \
  -F "note=light mayo"
```
(Getting the session cookie: easier to verify via Task 8's UI once built — this manual curl check is optional if Task 8 verification covers it. If curl is used, copy the `sb-*` cookies from the browser's DevTools → Application → Cookies after logging in.)

Expected: `200` with `{"analysis": {"description": "...", "calories": <number>, ...}}`.

- [ ] **Step 7: Commit**

```bash
git add lib/gemini.ts lib/gemini.test.ts app/api/analyze-food/route.ts
git commit -m "feat: add Gemini food analysis library and API route"
```

---

### Task 8: Image compression helper

**Files:**
- Create: `lib/image.ts`

**Interfaces:**
- Produces: `compressImage(file: File, maxDimension?: number, quality?: number): Promise<Blob>` — used by Task 9's meal log page before upload.

- [ ] **Step 1: Implement `lib/image.ts`**

```ts
/**
 * Resizes and JPEG-compresses an image file in the browser using a canvas,
 * so uploads stay small (keeps the free Supabase Storage quota lasting longer).
 */
export async function compressImage(file: File, maxDimension = 1280, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality
    );
  });
}
```

This function is browser-only (`createImageBitmap`, `document`, `canvas`) so it is exercised manually in Task 9's verification rather than under Vitest's node environment.

- [ ] **Step 2: Commit**

```bash
git add lib/image.ts
git commit -m "feat: add client-side image compression helper"
```

---

### Task 9: Meal logging page

**Files:**
- Create: `app/(app)/log/page.tsx`, `components/PhotoCapture.tsx`

**Interfaces:**
- Consumes: `compressImage` (Task 8), `createBrowserSupabase()` (Task 3), `POST /api/analyze-food` (Task 7, returns `{ analysis: FoodAnalysis }`).
- Produces: a row in `public.meal_logs` (Task 2 schema) and an object in the `meal-photos` bucket at `{user_id}/{meal_log_id}.jpg`; consumed by Task 10 (dashboard) and Task 11 (history).

- [ ] **Step 1: Create `components/PhotoCapture.tsx`**

```tsx
'use client';

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
}

export default function PhotoCapture({ onCapture }: PhotoCaptureProps) {
  return (
    <label className="block cursor-pointer rounded border-2 border-dashed border-gray-400 p-6 text-center">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCapture(file);
        }}
      />
      拍照记录
    </label>
  );
}
```

- [ ] **Step 2: Create `app/(app)/log/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoCapture from '@/components/PhotoCapture';
import { compressImage } from '@/lib/image';
import { createBrowserSupabase } from '@/lib/supabase/client';
import type { FoodAnalysis } from '@/lib/gemini';

export default function LogMealPage() {
  const router = useRouter();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCapture(file: File) {
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysis(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!photoFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const compressed = await compressImage(photoFile);
      const formData = new FormData();
      formData.append('photo', compressed, 'meal.jpg');
      formData.append('note', note);
      const res = await fetch('/api/analyze-food', { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? 'Analysis failed');
      }
      setAnalysis(body.analysis as FoodAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI分析失败, 可手动输入营养数据');
      setAnalysis({ description: '', calories: 0, carbsG: 0, proteinG: 0, fatG: 0 });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!analysis || !photoFile) return;
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not logged in');
      setSaving(false);
      return;
    }

    const mealId = crypto.randomUUID();
    const compressed = await compressImage(photoFile);
    const storagePath = `${user.id}/${mealId}.jpg`;
    const { error: uploadError } = await supabase.storage.from('meal-photos').upload(storagePath, compressed, {
      contentType: 'image/jpeg',
    });
    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('meal_logs').insert({
      id: mealId,
      user_id: user.id,
      photo_url: storagePath,
      user_note: note || null,
      ai_raw_description: analysis.description || null,
      calories: analysis.calories,
      carbs_g: analysis.carbsG,
      protein_g: analysis.proteinG,
      fat_g: analysis.fatG,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">记录一餐</h1>

      {!previewUrl && <PhotoCapture onCapture={handleCapture} />}

      {previewUrl && (
        <img src={previewUrl} alt="Meal preview" className="w-full rounded" />
      )}

      {previewUrl && !analysis && (
        <>
          <input
            type="text"
            placeholder="补充材料说明 (例如: low fat milk, light mayo)"
            className="w-full rounded border px-3 py-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
          >
            {analyzing ? '分析中…' : 'AI 分析'}
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {analysis && (
        <div className="space-y-3">
          <label className="block text-sm">食物描述
            <input className="mt-1 w-full rounded border px-3 py-2" value={analysis.description}
              onChange={(e) => setAnalysis({ ...analysis, description: e.target.value })} />
          </label>
          <label className="block text-sm">Calories
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.calories}
              onChange={(e) => setAnalysis({ ...analysis, calories: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">Carbs (g)
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.carbsG}
              onChange={(e) => setAnalysis({ ...analysis, carbsG: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">Protein (g)
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.proteinG}
              onChange={(e) => setAnalysis({ ...analysis, proteinG: Number(e.target.value) })} />
          </label>
          <label className="block text-sm">Fat (g)
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={analysis.fatG}
              onChange={(e) => setAnalysis({ ...analysis, fatG: Number(e.target.value) })} />
          </label>
          <button onClick={handleSave} disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
            {saving ? 'Saving…' : '确认保存'}
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, log in, visit `/log`.
1. Take/select a food photo → confirm preview shows.
2. Type a note like "light mayo" → click "AI 分析" → expect editable fields populated from Gemini within a few seconds.
3. Edit a value (e.g. calories) → click "确认保存" → expect redirect to `/`.
4. In Supabase Table Editor, confirm a new `meal_logs` row with your edited values, and a new object under Storage → `meal-photos` → `{your_user_id}/`.
5. Disconnect network or temporarily rename `GEMINI_API_KEY` in `.env.local` to simulate failure → click "AI 分析" → expect the red error text and a manual-entry form with zeroed fields you can still fill in and save.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/log/page.tsx" components/PhotoCapture.tsx
git commit -m "feat: add meal logging page with AI analysis and manual fallback"
```

---

### Task 10: Insulin logging page

**Files:**
- Create: `app/(app)/insulin/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabase()` (Task 3).
- Produces: a row in `public.insulin_logs` (Task 2 schema); consumed by Task 11 (dashboard) and Task 12 (history).

- [ ] **Step 1: Create `app/(app)/insulin/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

function nowForInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function InsulinLogPage() {
  const router = useRouter();
  const [units, setUnits] = useState('');
  const [loggedAt, setLoggedAt] = useState(nowForInput());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not logged in');
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from('insulin_logs').insert({
      user_id: user.id,
      units: Number(units),
      logged_at: new Date(loggedAt).toISOString(),
      note: note || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">记录胰岛素</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="number"
          step="0.5"
          required
          placeholder="Units"
          className="w-full rounded border px-3 py-2"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
        />
        <input
          type="datetime-local"
          required
          className="w-full rounded border px-3 py-2"
          value={loggedAt}
          onChange={(e) => setLoggedAt(e.target.value)}
        />
        <input
          type="text"
          placeholder="Note (optional)"
          className="w-full rounded border px-3 py-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving…' : '保存'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, log in, visit `/insulin`, submit units `4.5` with default time.
Expected: redirect to `/`; new row visible in Supabase Table Editor → `insulin_logs` with the correct `units` and `logged_at`.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/insulin/page.tsx"
git commit -m "feat: add insulin logging page"
```

---

### Task 11: Dashboard (today's remaining calories/macros)

**Files:**
- Create: `app/(app)/page.tsx`, `app/(app)/layout.tsx`, `components/DailyRing.tsx`
- Modify: remove the placeholder `app/page.tsx` from Task 1 (route now lives at `app/(app)/page.tsx`)

**Interfaces:**
- Consumes: `createServerSupabase()` (Task 3); reads `profiles.daily_*` (Task 2/6), `meal_logs` and `insulin_logs` for today (Task 2/9/10).
- Produces: the app's home page, linking to `/log`, `/insulin`, `/history` (Task 12).

- [ ] **Step 1: Remove the Task 1 placeholder**

Run: `git rm app/page.tsx`

- [ ] **Step 2: Create `app/(app)/layout.tsx`**

```tsx
import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link href="/">Dashboard</Link>
        <Link href="/log">记录一餐</Link>
        <Link href="/insulin">记录胰岛素</Link>
        <Link href="/history">历史</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/DailyRing.tsx`**

```tsx
interface DailyRingProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
}

export default function DailyRing({ label, consumed, target, unit }: DailyRingProps) {
  const remaining = Math.round(target - consumed);
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <div className="rounded border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{remaining} {unit} 剩余</p>
      <div className="mt-2 h-2 w-full rounded bg-gray-200">
        <div className="h-2 rounded bg-gray-900" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{Math.round(consumed)} / {target} {unit}</p>
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(app)/page.tsx`**

```tsx
import { createServerSupabase } from '@/lib/supabase/server';
import DailyRing from '@/components/DailyRing';
import { redirect } from 'next/navigation';

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/onboarding');

  const { start, end } = todayRange();
  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lte('logged_at', end)
    .order('logged_at', { ascending: false });

  const { data: insulinDoses } = await supabase
    .from('insulin_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lte('logged_at', end)
    .order('logged_at', { ascending: false });

  const consumed = (meals ?? []).reduce(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories),
      carbs: acc.carbs + Number(m.carbs_g),
      protein: acc.protein + Number(m.protein_g),
      fat: acc.fat + Number(m.fat_g),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold">今日</h1>
      <DailyRing label="Calories" consumed={consumed.calories} target={Number(profile.daily_calories)} unit="kcal" />
      <DailyRing label="Carbs" consumed={consumed.carbs} target={Number(profile.daily_carbs_g)} unit="g" />
      <DailyRing label="Protein" consumed={consumed.protein} target={Number(profile.daily_protein_g)} unit="g" />
      <DailyRing label="Fat" consumed={consumed.fat} target={Number(profile.daily_fat_g)} unit="g" />

      <section>
        <h2 className="font-semibold">今日餐记录</h2>
        <ul className="mt-2 space-y-2">
          {(meals ?? []).map((m) => (
            <li key={m.id} className="rounded border p-2 text-sm">
              {new Date(m.logged_at).toLocaleTimeString()} — {m.ai_raw_description || '未命名'} — {m.calories} kcal
            </li>
          ))}
          {(meals ?? []).length === 0 && <li className="text-sm text-gray-500">未有记录</li>}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">今日胰岛素</h2>
        <ul className="mt-2 space-y-2">
          {(insulinDoses ?? []).map((i) => (
            <li key={i.id} className="rounded border p-2 text-sm">
              {new Date(i.logged_at).toLocaleTimeString()} — {i.units} units {i.note ? `(${i.note})` : ''}
            </li>
          ))}
          {(insulinDoses ?? []).length === 0 && <li className="text-sm text-gray-500">未有记录</li>}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in with a fresh account (no profile row) → expect redirect to `/onboarding`. Complete onboarding → expect redirect to `/` showing four rings all at target (0 consumed). Log a meal via `/log` and insulin via `/insulin` → return to `/` → expect rings to reflect consumed amounts and both lists populated.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(app)/page.tsx" components/DailyRing.tsx app/page.tsx
git commit -m "feat: add dashboard with daily remaining calories/macros"
```

---

### Task 12: History page

**Files:**
- Create: `app/(app)/history/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabase()` (Task 3); reads `meal_logs`/`insulin_logs` (Task 2).
- Produces: a page listing past days grouped, with signed photo URLs where `photo_url` is still present.

- [ ] **Step 1: Create `app/(app)/history/page.tsx`**

```tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface DayGroup {
  date: string;
  meals: Array<{ id: string; time: string; description: string; calories: number; photoUrl: string | null }>;
  insulin: Array<{ id: string; time: string; units: number }>;
}

export default async function HistoryPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(200);

  const { data: insulinDoses } = await supabase
    .from('insulin_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(200);

  const groups = new Map<string, DayGroup>();

  for (const m of meals ?? []) {
    const date = new Date(m.logged_at).toLocaleDateString();
    if (!groups.has(date)) groups.set(date, { date, meals: [], insulin: [] });
    let photoUrl: string | null = null;
    if (m.photo_url) {
      const { data: signed } = await supabase.storage.from('meal-photos').createSignedUrl(m.photo_url, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }
    groups.get(date)!.meals.push({
      id: m.id,
      time: new Date(m.logged_at).toLocaleTimeString(),
      description: m.ai_raw_description || '未命名',
      calories: Number(m.calories),
      photoUrl,
    });
  }

  for (const i of insulinDoses ?? []) {
    const date = new Date(i.logged_at).toLocaleDateString();
    if (!groups.has(date)) groups.set(date, { date, meals: [], insulin: [] });
    groups.get(date)!.insulin.push({
      id: i.id,
      time: new Date(i.logged_at).toLocaleTimeString(),
      units: Number(i.units),
    });
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-xl font-semibold">历史</h1>
      {sortedGroups.map((g) => (
        <section key={g.date} className="space-y-2">
          <h2 className="font-semibold">{g.date}</h2>
          {g.meals.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded border p-2 text-sm">
              {m.photoUrl && <img src={m.photoUrl} alt={m.description} className="h-12 w-12 rounded object-cover" />}
              <span>{m.time} — {m.description} — {m.calories} kcal</span>
            </div>
          ))}
          {g.insulin.map((i) => (
            <div key={i.id} className="rounded border p-2 text-sm">
              {i.time} — 胰岛素 {i.units} units
            </div>
          ))}
        </section>
      ))}
      {sortedGroups.length === 0 && <p className="text-sm text-gray-500">未有历史记录</p>}
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, log in, visit `/history` after having logged at least one meal (with photo) and one insulin dose.
Expected: today's date group shows the meal thumbnail (loads via a signed URL) and the insulin entry.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/history/page.tsx"
git commit -m "feat: add history page grouped by day with signed photo URLs"
```

---

### Task 13: PWA manifest + minimal service worker

**Files:**
- Create: `public/manifest.json`, `public/sw.js`, `public/icon-192.png`, `public/icon-512.png`, `components/RegisterSW.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: an installable PWA (Add to Home Screen) with no new dependency.

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "Calorie Tracker",
  "short_name": "CalTrack",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111827",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Generate placeholder icons**

Run:
```bash
node -e "
const { createCanvas } = require('canvas');
" 2>/dev/null || echo "no canvas module — using ImageMagick fallback instead"
```
Since no image library is a dependency (per Global Constraints — avoid unneeded deps), generate the two PNGs with any tool already on the machine, e.g. ImageMagick:
```bash
convert -size 192x192 xc:'#111827' public/icon-192.png
convert -size 512x512 xc:'#111827' public/icon-512.png
```
If ImageMagick isn't installed, create the two files with any image editor (a solid-color square is enough) and save them at `public/icon-192.png` / `public/icon-512.png`. This step just needs two valid PNG files to exist at those paths — exact appearance can be refined later.

- [ ] **Step 3: Create `public/sw.js`**

```js
const CACHE_NAME = 'calorie-tracker-shell-v1';
const SHELL_URLS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});
```

- [ ] **Step 4: Create `components/RegisterSW.tsx`**

```tsx
'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // PWA install just won't be available; app still works over the network.
      });
    }
  }, []);
  return null;
}
```

- [ ] **Step 5: Wire it into `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import RegisterSW from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: 'Calorie Tracker',
  description: 'Personal calorie and insulin tracker',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run build && npm run start` (service workers are skipped in `next dev`'s uncached mode in some browsers — verify against a production build). Open `http://localhost:3000` in Chrome, DevTools → Application → Manifest: confirm it loads with both icons; Application → Service Workers: confirm `sw.js` is activated. On an Android phone on the same network, open the site and check the browser's "Add to Home Screen" / install prompt appears.

- [ ] **Step 7: Commit**

```bash
git add public/manifest.json public/sw.js public/icon-192.png public/icon-512.png components/RegisterSW.tsx app/layout.tsx
git commit -m "feat: add PWA manifest and minimal service worker"
```

---

### Task 14: Photo retention cleanup (6-month auto-delete)

**Files:**
- Create: `supabase/functions/cleanup-old-photos/index.ts`, `supabase/migrations/0002_cleanup_cron.sql`

**Interfaces:**
- Produces: a scheduled job that, daily, deletes storage objects for `meal_logs` older than 6 months and sets `photo_url` to `null` (numeric nutrition data untouched), per the spec's retention rule.

- [ ] **Step 1: Write the Edge Function**

`supabase/functions/cleanup-old-photos/index.ts`:
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CLEANUP_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: oldMeals, error: fetchError } = await supabase
    .from('meal_logs')
    .select('id, photo_url')
    .not('photo_url', 'is', null)
    .lt('logged_at', sixMonthsAgo.toISOString());

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  let deletedCount = 0;
  for (const meal of oldMeals ?? []) {
    if (!meal.photo_url) continue;
    const { error: removeError } = await supabase.storage.from('meal-photos').remove([meal.photo_url]);
    if (removeError) continue;
    await supabase.from('meal_logs').update({ photo_url: null }).eq('id', meal.id);
    deletedCount += 1;
  }

  return new Response(JSON.stringify({ deletedCount }), { status: 200 });
});
```

- [ ] **Step 2: Deploy the function**

Run:
```bash
supabase functions deploy cleanup-old-photos --no-verify-jwt
supabase secrets set CLEANUP_FUNCTION_SECRET=<a-long-random-string-you-generate>
```
(Requires the Supabase CLI logged in and linked to the project: `supabase login`, `supabase link --project-ref <ref>`.)

- [ ] **Step 3: Schedule it with pg_cron**

`supabase/migrations/0002_cleanup_cron.sql`:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cleanup-old-meal-photos-daily',
  '0 3 * * *', -- 03:00 UTC daily
  $$
  select net.http_post(
    url := '<your-project-ref>.functions.supabase.co/cleanup-old-photos',
    headers := jsonb_build_object('Authorization', 'Bearer <the-CLEANUP_FUNCTION_SECRET-value>'),
    body := '{}'::jsonb
  );
  $$
);
```
Replace `<your-project-ref>` and `<the-CLEANUP_FUNCTION_SECRET-value>` with the real values before running. Apply via SQL Editor same as Task 2.

- [ ] **Step 4: Manual verification**

1. Trigger the function directly to confirm it works before waiting for the cron:
```bash
curl -X POST https://<your-project-ref>.functions.supabase.co/cleanup-old-photos \
  -H "Authorization: Bearer <the-CLEANUP_FUNCTION_SECRET-value>"
```
Expected: `200 {"deletedCount": 0}` (0 is correct if no meals are yet 6+ months old).
2. In SQL Editor: `select jobname, schedule from cron.job where jobname = 'cleanup-old-meal-photos-daily';` — confirm the row exists with the expected schedule.
3. To test actual deletion without waiting 6 months, temporarily insert a test `meal_logs` row with `logged_at` set 7 months in the past and a real `photo_url` pointing at an uploaded test object, re-run the curl call, confirm `deletedCount: 1` and that the storage object and `photo_url` are gone. Delete the test row afterward.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/cleanup-old-photos/index.ts supabase/migrations/0002_cleanup_cron.sql
git commit -m "feat: add scheduled cleanup of meal photos older than 6 months"
```

---

### Task 15: Netlify deployment

**Files:**
- Create: `netlify.toml`

**Interfaces:**
- Produces: a public HTTPS URL serving the app (needed for PWA installability, camera `capture` attribute, and Gemini/Supabase to work outside localhost).

- [ ] **Step 1: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- [ ] **Step 2: Add the Netlify Next.js plugin**

Run: `npm install -D @netlify/plugin-nextjs`

- [ ] **Step 3: Deploy**

1. Push the repo to GitHub (or `netlify deploy` directly from CLI: `npx netlify-cli deploy --build --prod`).
2. In the Netlify dashboard, create a new site from the repo (or confirm the CLI-created one).
3. Set environment variables under Site configuration → Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` — same values as `.env.local`.
4. Trigger a deploy.

- [ ] **Step 4: End-to-end smoke test on the deployed URL** (per spec's testing section)

On the live HTTPS URL, on an actual phone:
1. Log in → redirected correctly.
2. Complete onboarding with a goal that triggers the safety warning → confirm it appears and the override checkbox gates saving.
3. `/log` → take a real photo with the phone camera → add a note → AI analyze → edit a field → save.
4. `/insulin` → log a dose.
5. `/` → confirm rings show correct remaining values matching what was just logged.
6. `/history` → confirm the meal appears with its photo.
7. Add the site to the home screen from the mobile browser menu → confirm it opens standalone (no browser chrome).

- [ ] **Step 5: Commit**

```bash
git add netlify.toml package.json package-lock.json
git commit -m "chore: configure Netlify deployment"
```

---

## Self-Review Notes

- **Spec coverage:** tech architecture (Task 1, 3, 15), Supabase auth/DB/storage (Task 2, 3, 4), Gemini AI analysis (Task 7), data model incl. `target_weight_kg`/`target_date` (Task 2, 6), goal safety check (Task 5, 6), meal logging incl. optional ingredient note (Task 8, 9), insulin logging (Task 10), dashboard remaining calories/macros (Task 11), history with photos (Task 12), PWA installability (Task 13), 6-month photo cleanup (Task 14), error handling/fallback for AI failure (Task 9 Step 3.5), all covered.
- **Placeholder scan:** no TBD/TODO left; the one step that names external tool availability (Task 13 Step 2, icon generation) gives a concrete fallback instruction rather than deferring the work.
- **Type consistency:** `FoodAnalysis`, `ProfileInput`, `DailyTargets`, `GoalCheckResult` field names verified identical across Task 5/6/7/9 usages (`carbsG`/`proteinG`/`fatG` camelCase in TS layer; `carbs_g`/`protein_g`/`fat_g` snake_case only at the Supabase insert/select boundary, consistent with Task 2's SQL column names).
