import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), name: text('name').notNull(), firstName: text('first_name'), lastName: text('last_name'),
  username: text('username').unique(), email: text('email').notNull().unique(), phone: text('phone'), city: text('city'), country: text('country'),
  additionalInfo: text('additional_info'), passwordHash: text('password_hash').notNull(), photoUrl: text('photo_url'), language: text('language').notNull().default('English'),
  savedDestinations: text('saved_destinations').notNull().default('[]'), role: text('role').notNull().default('traveler'), createdAt: text('created_at').notNull(),
});
export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), name: text('name').notNull(),
  startDate: text('start_date').notNull(), endDate: text('end_date').notNull(), description: text('description'), coverPhotoUrl: text('cover_photo_url'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false), budgetLimit: real('budget_limit').notNull().default(0), createdAt: text('created_at').notNull(),
});
export const stops = sqliteTable('stops', {
  id: text('id').primaryKey(), tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }), cityName: text('city_name').notNull(),
  country: text('country').notNull(), startDate: text('start_date').notNull(), endDate: text('end_date').notNull(), sortOrder: integer('sort_order').notNull().default(0),
});
export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(), stopId: text('stop_id').notNull().references(() => stops.id, { onDelete: 'cascade' }), title: text('title').notNull(),
  category: text('category').notNull(), cost: real('cost').notNull().default(0), durationMinutes: integer('duration_minutes').notNull().default(60),
  notes: text('notes'), activityDate: text('activity_date'), startTime: text('start_time'),
});
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(), tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }), category: text('category').notNull(),
  amount: real('amount').notNull(), dayDate: text('day_date'),
});
export const citiesCatalog = sqliteTable('cities_catalog', {
  id: text('id').primaryKey(), name: text('name').notNull(), country: text('country').notNull(), region: text('region').notNull(),
  avgCostIndex: real('avg_cost_index').notNull(), popularityScore: integer('popularity_score').notNull(), tagline: text('tagline').notNull(),
});
