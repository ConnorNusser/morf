---
name: verify
description: Build the Expo web bundle and drive real flows (feed, profile modal, workout finish) headlessly with Playwright to verify UI changes at runtime.
---

# Verifying Morf UI changes (Expo web + Playwright)

Works from any worktree root that has `.env` copied and `node_modules` linked
(`ln -s /Users/connor/repo/morph/node_modules node_modules`).

## Build + serve

```bash
CI=1 npx expo export --platform web        # bakes EXPO_PUBLIC_* from .env into dist/
```

Serve `dist/` with the static server pattern from `visual-loop/capture.js`
(plain `http.createServer`, falls back to `/index.html`), then drive with
`require('/Users/connor/repo/morph/node_modules/playwright-core')`,
`chromium.launch({ channel: 'chrome', headless: true })`, viewport 390×844.

## Gotchas that cost time

- **Identity is native-only on web.** SecureStore has no web impl, so
  `getCurrentUser()` is null and the feed silently renders "No posts yet".
  Fix by mocking ONLY the identity lookup — everything else stays live:
  ```js
  await page.route((url) => url.href.includes('/rest/v1/users') && url.href.includes('device_id=eq'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', username: 'verifier', profile_picture_url: null }) }));
  ```
- **Seed localStorage after first `goto`, then `reload()`** — AsyncStorage on
  web is plain `localStorage` with raw keys (see `lib/storage/storage.ts`
  `STORAGE_KEYS`). Useful keys: `home_view_mode` = `feed` | `home`,
  `active_note_session` (JSON: noteText/startTime/routineId/draft/manuallyStarted),
  `user_profile`, `workout_history`.
- Supabase 406s on `users?device_id=eq...` are just `.single()` with no row —
  noise, not breakage. Same for expo-notifications console errors on web.

## Flows

- **Feed**: seed `home_view_mode=feed`, wait for `text=/^@/` (live data from
  feed.morf.fyi + Supabase; allow ~45s). Tier colors come from
  `user_percentiles.strength_level`; cross-check with curl against
  `$EXPO_PUBLIC_SUPABASE_URL/rest/v1/user_percentiles` (headers `apikey` +
  `Authorization: Bearer` from `.env`) joined to
  `https://feed.morf.fyi/api/workouts?limit=15` (`x-user-id: <any uuid>`).
- **Other-user profile**: from the feed, `page.click('text="@<name>"')` →
  UserProfileModal; give it ~6s to fetch lifts/percentiles/workouts.
- **Workout finish → celebration**: seed `active_note_session` +
  `user_profile`, goto `/workout`, click `Finish`, then `Finish Workout` on
  the confirmation sheet → WorkoutCompleteScreen renders (local parser path,
  no Gemini needed). Note: safe-area insets are 0 on web, so inset-dependent
  spacing needs an iOS run to verify exactly.
