import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { eq, inArray, max, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { appSettings, reportDays, reportMonths } from '../../db/schema.js';

const ALLOWED_SETTING_KEYS = new Set([
  'report-metadata',
  'report-admins',
  'report-units',
  'report-workers',
  'sample-data-cleared',
]);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...headers,
    },
  });

const imageStore = () => getStore({ name: 'report-images', consistency: 'strong' });

type IncomingMonth = {
  workerId?: string | null;
  year: number;
  month: number;
  isSampleData?: boolean;
  days?: Record<string, unknown>;
};

async function getVersion() {
  const [[a], [b]] = await Promise.all([
    db.select({ v: max(appSettings.updatedAt) }).from(appSettings),
    db.select({ v: max(reportMonths.updatedAt) }).from(reportMonths),
  ]);
  const times = [a?.v, b?.v]
    .filter(Boolean)
    .map((d) => new Date(d as Date).getTime());
  return times.length ? String(Math.max(...times)) : null;
}

async function loadMonth(monthKey: string) {
  const [header] = await db
    .select()
    .from(reportMonths)
    .where(eq(reportMonths.monthKey, monthKey));
  if (!header) return null;
  const dayRows = await db
    .select()
    .from(reportDays)
    .where(eq(reportDays.monthKey, monthKey));
  const days: Record<number, unknown> = {};
  for (const r of dayRows) days[r.dayNumber] = r.data;
  return {
    monthKey: header.monthKey,
    workerId: header.workerId ?? undefined,
    year: header.year,
    month: header.month,
    isSampleData: header.isSampleData || undefined,
    updatedAt: header.updatedAt.toISOString(),
    days,
  };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [resource, id] = parts;

  try {
    // ---- Change detection for cross-device sync ----
    if (resource === 'version' && req.method === 'GET') {
      return json({ version: await getVersion() });
    }

    // ---- Shared master data (admins, units, workers, metadata) ----
    if (resource === 'settings') {
      if (req.method === 'GET' && !id) {
        const rows = await db.select().from(appSettings);
        const out: Record<string, unknown> = {};
        for (const r of rows) out[r.key] = r.value;
        return json({ settings: out, version: await getVersion() });
      }
      if (req.method === 'PUT' && id) {
        if (!ALLOWED_SETTING_KEYS.has(id)) return json({ error: 'Unknown key' }, 400);
        const body = await req.json();
        const onlyIfAbsent = url.searchParams.get('ifAbsent') === '1';
        const insert = db.insert(appSettings).values({ key: id, value: body.value, updatedAt: new Date() });
        if (onlyIfAbsent) {
          await insert.onConflictDoNothing();
        } else {
          await insert.onConflictDoUpdate({
            target: appSettings.key,
            set: { value: body.value, updatedAt: new Date() },
          });
        }
        const [row] = await db.select().from(appSettings).where(eq(appSettings.key, id));
        return json({ value: row?.value ?? null });
      }
    }

    // ---- Monthly reports (stored per day) ----
    if (resource === 'months' && id) {
      if (req.method === 'GET') {
        const month = await loadMonth(id);
        return month ? json(month) : json({ error: 'Not found' }, 404);
      }
      if (req.method === 'PUT') {
        const body = (await req.json()) as IncomingMonth;
        if (!Number.isInteger(body.year) || !Number.isInteger(body.month)) {
          return json({ error: 'Invalid month payload' }, 400);
        }
        const now = new Date();
        const onlyIfAbsent = url.searchParams.get('ifAbsent') === '1';

        const headerInsert = db.insert(reportMonths).values({
          monthKey: id,
          workerId: body.workerId ?? null,
          year: body.year,
          month: body.month,
          isSampleData: Boolean(body.isSampleData),
          updatedAt: now,
        });
        const inserted = onlyIfAbsent
          ? await headerInsert.onConflictDoNothing().returning({ k: reportMonths.monthKey })
          : await headerInsert
              .onConflictDoUpdate({
                target: reportMonths.monthKey,
                set: {
                  workerId: body.workerId ?? null,
                  isSampleData: Boolean(body.isSampleData),
                  updatedAt: now,
                },
              })
              .returning({ k: reportMonths.monthKey });

        if (onlyIfAbsent && inserted.length === 0) {
          // Another device already created this month — return the stored copy
          return json(await loadMonth(id));
        }

        const entries = Object.entries(body.days ?? {})
          .map(([k, v]) => ({ dayNumber: Number(k), data: v }))
          .filter((e) => Number.isInteger(e.dayNumber) && e.dayNumber >= 1 && e.dayNumber <= 31 && e.data);

        if (entries.length > 0) {
          await db
            .insert(reportDays)
            .values(entries.map((e) => ({ monthKey: id, dayNumber: e.dayNumber, data: e.data, updatedAt: now })))
            .onConflictDoUpdate({
              target: [reportDays.monthKey, reportDays.dayNumber],
              set: { data: sql`excluded.data`, updatedAt: now },
            });
        }
        return json(await loadMonth(id));
      }
    }

    // ---- Lightweight listing of all months (used for full backup export) ----
    if (resource === 'months' && !id && req.method === 'GET') {
      const keys = url.searchParams.get('keys');
      const headers = keys
        ? await db.select().from(reportMonths).where(inArray(reportMonths.monthKey, keys.split(',')))
        : await db.select().from(reportMonths);
      const results = [];
      for (const h of headers) results.push(await loadMonth(h.monthKey));
      return json({ months: results.filter(Boolean) });
    }

    // ---- Images (photos, signatures, logos) stored once by content hash ----
    if (resource === 'images') {
      if (req.method === 'GET' && id) {
        const data = await imageStore().get(id, { type: 'text' });
        if (data === null) return json({ error: 'Not found' }, 404);
        return new Response(data, {
          headers: {
            'content-type': 'text/plain',
            'cache-control': 'public, max-age=31536000, immutable',
          },
        });
      }
      if (req.method === 'PUT' && id) {
        if (!/^[a-f0-9]{64}$/.test(id)) return json({ error: 'Invalid hash' }, 400);
        const data = await req.text();
        if (!data.startsWith('data:image/')) return json({ error: 'Invalid image' }, 400);
        await imageStore().set(id, data);
        return json({ ok: true });
      }
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error', err);
    return json({ error: 'Server error' }, 500);
  }
};

export const config: Config = {
  path: '/api/*',
};
