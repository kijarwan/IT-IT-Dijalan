import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Key-value store for shared master data: admins, units, workers, report metadata, flags
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per worker per month (header for a monthly report)
export const reportMonths = pgTable('report_months', {
  monthKey: text('month_key').primaryKey(),
  workerId: text('worker_id'),
  year: integer().notNull(),
  month: integer().notNull(),
  isSampleData: boolean('is_sample_data').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per day inside a monthly report, so concurrent edits on different days never overwrite each other
export const reportDays = pgTable(
  'report_days',
  {
    monthKey: text('month_key')
      .notNull()
      .references(() => reportMonths.monthKey, { onDelete: 'cascade' }),
    dayNumber: integer('day_number').notNull(),
    data: jsonb().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.monthKey, t.dayNumber] })]
);
