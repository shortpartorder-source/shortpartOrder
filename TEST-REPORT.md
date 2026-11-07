# v3.5.0 — part search covers every catalogue

Same rule as the Parts Order System: whichever catalogue you pick, search looks in **all** catalogues.

| What | How it works |
|---|---|
| Loading | The chosen catalogue loads first (as before); every other catalogue loads in the background (from the device cache after the first time). Status line: "Searching 2 catalogues · 1,39,740 parts" (shows "loading … %" while one is still coming). |
| Order of results | Best match first (exact code → starts with → contains → alt code → description); for equally good matches the chosen catalogue comes first. |
| Which catalogue | Every result shows its catalogue name (indigo = the one you chose, teal = another). The same part code in two catalogues appears twice, each with its own price. |
| Filter chips | All catalogues (n) · each catalogue (n) — tap to see one catalogue only. |
| Adding | A part added from another catalogue keeps that catalogue's price and remembers its catalogue (shown on the Review step, saved in the order). |
| Live | A part added to any catalogue is searchable straight away on every device. Catalogues still uploading are never searched. |
| Speed | 1,39,740 parts: 35–85 ms per search on a CPU slowed 4× (instant in use). |
Also fixed: "1 units" wording.

Tests: cross-catalogue 25/25 (desktop staff + phone admin) · full end-to-end 234/234 · quick 31/31 · reports, tables, search, upload, upload-card all pass. Database: no change.

---

# v3.4.2 — upload card close button fixed

| Problem | Cause | Fix |
|---|---|---|
| The ✕ on the "Upload complete" card did nothing | After an upload the screen redraws itself; the card came back but its ✕ was no longer connected | ✕ handled by one page-wide listener, so it works however the card was drawn |

Tested on desktop and phone: ✕ closes the success and error cards right after upload, after leaving and returning to Parts Sheets, and after a live refresh from another device. Full end-to-end 234/234; upload failure checks all pass. No database change.

---

# v3.4.1 test report — Excel upload fixed

## Bugs found (tested as admin with 8 realistic Excel files)
| # | Problem | What happened | Fix |
|---|---|---|---|
| 1 | Progress vanished | Creating the catalogue triggered a live refresh of Parts Sheets, wiping the progress card — no progress, no "Upload complete" | Progress is kept in app state and redrawn after every refresh; finish/fail message stays until dismissed |
| 2 | Title rows above the headings | "No Part No column found" | Header row searched in the first 30 rows |
| 3 | GST / Tax Rate column before MRP | **Every price saved as 18** | Columns chosen by meaning with priority (MRP > Price > Rate > Amount); GST/tax/discount/qty columns never used as price; warning if prices look like GST % |
| 4 | Long numeric part codes | 100074568000 saved as "1.00075E+11" (all codes identical) | Real cell values read; leading zeros kept; CSV read as text |
| 5 | Summary sheet first / "Material", "Rate" headings | Rejected | All sheets checked (largest usable one chosen, can switch); more heading names recognised |
| 6 | One network error | Whole upload thrown away; 134 batches sent one at a time | 1,000-row batches, 3 at a time, each retried up to 5 times; first hard failure stops all batches and removes the half catalogue |
| 7 | Half-uploaded catalogue visible to staff | Staff could open it mid-upload | Hidden from New Order until finished; an interrupted upload is shown to admin as "did not finish — remove it" |

## New: check screen before saving
Catalogue name · detected columns (change any of them) · first rows exactly as they will be saved · counts (parts, empty rows skipped, repeated rows skipped) · warnings (no price column, prices look like GST %, codes all the same, catalogue name already exists).

## Results
| Test | Result |
|---|---|
| 8 Excel layouts (normal, title rows, GST column, numeric codes, summary sheet first, 66,557 rows, messy commas/₹/blank rows, SAP "Material/Rate") | all uploaded with correct columns, prices, codes and counts |
| Flaky network (every 5th batch fails twice) | retried; exactly 66,557 parts, no duplicates |
| Dead network | clear message; catalogue and all its parts removed |
| Staff during upload / after | not visible / visible |
| 66,557 parts (200 ms per call) | ~2 s to check screen, ~7 s upload (was ~30 s, one batch at a time) |
| Full end-to-end | 234/234 |
| Quick run · Reports · Tables · Search | 31/31 · all pass · all pass · 10/10 |
Database: no change (setup.sql identical to v3.4).

---

# v3.4 test report

## Fixed — parts tables (All / Short / Damaged / Received / Wrong)
| Problem | Cause | Fix |
|---|---|---|
| Total column cut off (worst in "All") | Long descriptions + DC/LR chips + status chips made the Part column very wide; the card clipped the rest | Part details now quiet text under the description (HSN · DC/LR · CN · user), description max 2 lines, Part column width capped |
| No sideways scrollbar / scrollbar off screen | Table had no scroll area of its own | Table scrolls inside its own box that always fits the window → sideways scrollbar always visible; fade on the right edge when more columns exist |
| Numbers columns too wide | Two CSS bugs: percentage widths inflating the table, and the "qty × MRP" captions losing their style | Fixed; columns now size to their figures |
| Header could hide under the top bar | Page could scroll past the table | Box height computed to fit below the top bar |
Also: # and Part columns stay pinned while scrolling sideways; calmer colours and lighter fonts for numbers; Compact rows show status as a coloured dot (row stripe already shows it), full chip in Comfortable and on phones; wide screens use up to 1680 px.

At 1366 px (your screen) all 8 columns fit with **no** sideways scrolling, in both Comfortable and Compact, in every filter.

## Results
| Suite | Result |
|---|---|
| Table checks with realistic long data, 5 screen sizes × (Short, All): totals vs database, every row Total = Qty × Inv MRP, 0 misaligned cells, Total reachable, scrollbar on screen, Part pinned, header never hidden | all pass |
| Full end-to-end | 233/233 |
| Quick run | 31/31 |
| Reports | 24/24 |
| Search highlight / History filter | 10/10 |

---

# v3.3 test report

## New in v3.3 — Reports (admin only)
| Part | What it shows |
|---|---|
| Date range | This month · Last month · Last 3 months · Last 6 months · This year · All time · Custom (from–to; dates entered backwards are swapped). Choice is remembered. |
| Include drafts | On by default so "All time" matches the Dashboard; untick to count finished orders only. |
| Pending vs received | Pending ₹ (short + damaged + wrong), Received ₹, % recovered; a split bar by status; **pending by age** (0–30 / 31–60 / 61–90 / over 90 days since invoice date, over-90 row highlighted). |
| Monthly trend | Stacked bars per invoice month (empty months shown as zero), switch ₹ Value / Units / Parts, hover or tap a month for exact figures, plus a month-by-month table with totals and recovered %. |
| Live | Updates by itself when any device adds, edits or deletes an order. |
Value = qty × invoice MRP everywhere (same as Dashboard and tables). No export, as requested.

Staff deleting orders: already allowed for their own orders (unchanged); logged with a copy the admin can restore for 30 days.

## Results
| Suite | Result |
|---|---|
| Full end-to-end | 233/233 |
| Quick run | 31/31 |
| Reports: every preset's pending/received, month table, age table and unit totals checked against the database; custom range; drafts toggle; staff blocked; staff self-delete; live updates; phone layout | 24/24 |
| Table accuracy & alignment (4 sizes) | all pass |
| Search highlight / History filter | 10/10 |

---

# v3.2 test report

## What changed
| Area | Change |
|---|---|
| Catalogue loading | One database function sends parts in 20,000-part chunks, 4 at a time (was 67 pages one after another). Saved copy moved to IndexedDB — the old localStorage copy was too small for 66k parts, so it silently re-downloaded every time. Only newly added parts are fetched when a sheet grows. Last-used catalogue preloads after login; hovering a catalogue card starts the download. |
| Search | Matching text is highlighted (code, alt code, description; "son723" highlights "SON-723"). Best matches first: exact code → starts with → contains → description. Header shows "Top 30 of N matches". |
| History | **Bug fixed:** admin could see "0 of 33 orders" — a user filter stayed on while the dropdown (built before orders arrived) showed "All users". Dropdown now always matches the real filter, lists each user with order counts, clears a filter for a user that no longer exists, and an empty result offers "Clear filters". Every order shows "Created by <user>" + time. Search matches are highlighted. |
| Status table | Uses the whole window: page scrolls, headings pin under the top bar, totals pin to the bottom. Compact (default, one line per part) / Comfortable toggle, remembered. Columns size to content. **Bug fixed:** the cart editor's `.qty` style was hitting the table's Qty cell (caused stray lines + misalignment). Footer labelled "qty × MRP" so totals aren't mistaken for column sums. Cards on screens ≤1100 px. |
| Logout | Glass button with a red icon chip, red on hover. |

## Results
| Suite | Result |
|---|---|
| Full end-to-end (2 devices, live sync, lock, offline, exports, layout ×5 sizes) | 233/233 |
| Quick run | 31/31 |
| Table accuracy (4 screen sizes): every row Total = Qty × Inv MRP, footer = database = row sums, 0 misaligned cells, nothing clipped, sticky header/footer | all pass |
| Search highlight / History filter | 10/10 |
| setup.sql on PostgreSQL 16, run twice; new function as `anon` | OK |

## Speed (simulated 200 ms per call, ~4 Mbit/s)
| | Before | v3.2 |
|---|---|---|
| First load, 66,557-part catalogue | ~19.3 s | ~5–7 s (~7–9 s before re-running setup.sql) |
| Every later visit | re-downloaded (~19 s) | ~0.4 s |
| Rows visible at 1366×646 | 2 | 10 (compact), 19 at 1920×1080 |
| Open status table (CPU ×4) | 0.29 s | 0.20 s |
Real first-load time depends on your internet; the "later visit" saving is the big one.
