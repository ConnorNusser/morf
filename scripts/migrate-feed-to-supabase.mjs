#!/usr/bin/env node
/**
 * One-time copy of the self-hosted feed (feed.morf.fyi) into Supabase
 * (tables from supabase/migrations/017_feed_on_supabase.sql).
 *
 *   node --env-file=.env scripts/migrate-feed-to-supabase.mjs           # dry run: counts only
 *   node --env-file=.env scripts/migrate-feed-to-supabase.mjs --apply   # copy
 *
 * Reads through the server's public GET endpoints, re-hosts post media into
 * the `post-media` bucket under `migrated/`, and inserts rows keeping their
 * ids and created_at. Safe to re-run: existing rows are skipped (ON CONFLICT
 * DO NOTHING) and already-uploaded media is reused.
 *
 * Needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY (the anon key is
 * enough: the migration allows anon inserts and media uploads).
 */
import { createClient } from '@supabase/supabase-js';

const FEED_API_URL = process.env.FEED_API_URL || 'https://feed.morf.fyi';
const PAGE = 100;
const apply = process.argv.includes('--apply');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY (e.g. node --env-file=.env ...)');
  process.exit(1);
}
const supabase = createClient(url, key);

async function fetchAll(path) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${FEED_API_URL}${path}?limit=${PAGE}&offset=${offset}`, {
      headers: { 'x-user-id': '00000000-0000-0000-0000-000000000000' },
    });
    if (!res.ok) throw new Error(`GET ${path} offset ${offset}: ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function rehostMedia(item) {
  // Server stores relative paths like /media/<userId>/<file>.
  const absolute = item.url.startsWith('http') ? item.url : `${FEED_API_URL}${item.url}`;
  if (absolute.includes('/storage/v1/object/public/')) return item; // already on Supabase

  const objectPath = `migrated/${item.url.replace(/^.*\/media\//, '')}`;
  const bucket = supabase.storage.from('post-media');
  const publicUrl = bucket.getPublicUrl(objectPath).data.publicUrl;

  const res = await fetch(absolute);
  if (!res.ok) throw new Error(`download ${absolute}: ${res.status}`);
  const contentType = res.headers.get('content-type') || (item.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const body = await res.arrayBuffer();

  const { error } = await bucket.upload(objectPath, body, { contentType });
  if (error && !/exists|duplicate/i.test(error.message)) {
    throw new Error(`upload ${objectPath}: ${error.message}`);
  }
  return { url: publicUrl, type: item.type };
}

async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += PAGE) {
    const chunk = rows.slice(i, i + PAGE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`insert ${table} rows ${i}-${i + chunk.length}: ${error.message}`);
  }
}

const workouts = await fetchAll('/api/workouts');
const posts = await fetchAll('/api/posts');
const mediaCount = posts.reduce((n, p) => n + (p.media?.length ?? 0), 0);
console.log(`Source: ${workouts.length} workouts, ${posts.length} posts, ${mediaCount} media files`);

if (!apply) {
  console.log('Dry run. Re-run with --apply to copy.');
  process.exit(0);
}

await insert(
  'feed_workouts',
  workouts.map((w) => ({
    id: w.id,
    user_id: w.user_id,
    username: w.username ?? '',
    profile_picture_url: w.profile_picture_url ?? null,
    title: w.title,
    duration_seconds: w.duration_seconds,
    exercise_count: w.exercise_count,
    set_count: w.set_count,
    total_volume: w.total_volume,
    total_distance_meters: w.total_distance_meters ?? 0,
    total_cardio_seconds: w.total_cardio_seconds ?? 0,
    exercises: w.exercises ?? [],
    feed_data: w.feed_data ?? { likes: [], comments: [] },
    created_at: w.created_at,
  }))
);
console.log(`Copied ${workouts.length} workouts`);

const postRows = [];
let failedMedia = 0;
for (const p of posts) {
  const media = [];
  for (const m of p.media ?? []) {
    try {
      media.push(await rehostMedia(m));
    } catch (e) {
      failedMedia++;
      console.warn(`  post ${p.id}: ${e.message}`);
    }
  }
  postRows.push({
    id: p.id,
    user_id: p.user_id,
    username: p.username ?? '',
    profile_picture_url: p.profile_picture_url ?? null,
    text: p.text ?? '',
    media,
    feed_data: p.feed_data ?? { likes: [], comments: [] },
    created_at: p.created_at,
  });
}
await insert('feed_posts', postRows);
console.log(`Copied ${posts.length} posts (${mediaCount - failedMedia}/${mediaCount} media re-hosted)`);
