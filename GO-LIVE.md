# Short Parts Tracker v3.5.0 — go-live steps

1. **Back up**: Supabase → Table Editor → short_orders → Export CSV.
2. **Database** (no change in v3.5.0 — skip if you already ran it for v3.2 or later): Supabase → SQL Editor → paste ALL of `setup.sql` → Run → "Setup complete!".
   Safe to run twice; never deletes data. Works on any earlier version. **Re-run it if you have not since v3.2** — it adds the fast catalogue loader (the app still works without it, just slower).
3. **Upload** `index.html`, `app.js`, `styles.css`, `manifest.json` (keep your icon PNGs).
4. **Logins**
   - `admin` / `admin123` — sees everything (all users' orders)
   - `test123` / `pass123` — owns and sees all orders that existed before the upgrade
   - new users you add in Admin → Users start with an empty History
   Change both passwords (Admin → Users → Password).
   If you had already created a `test123` user yourself, it keeps the password you gave it.
5. Every device: reload once (the `?v=3.5.0` in index.html makes phones fetch the new files).

## Quick two-device check
- Staff user sees only own orders; admin sees everyone's with the owner name
- Create order on phone → appears on PC within ~1 s
- Admin locks app → staff save is blocked and they are logged out
- Turn Wi-Fi off/on during edits → changes catch up

## Known limits
- Owner filter + app lock are enforced by the app; passwords, users, sessions, log and admin
  actions are enforced by the database. Full protection would need Supabase Auth.
- Admin can read every password (stored encrypted).
