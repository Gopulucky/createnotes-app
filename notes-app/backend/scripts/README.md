# Screenshot -> Notes automation (free, no Claude needed)

**Easiest option:** use the site itself. Log in, click **Import** in the top nav, select a
folder of screenshots, paste a free Gemini API key, pick a course and module name, and hit
Start Import — it streams progress live and saves straight to the database. The key is never
stored anywhere; it's held in memory for that one request and discarded.

The two scripts below do the exact same thing from the command line, useful if you'd rather
not type your API key into a form, or want to inspect/edit the generated content before it's
imported. Run them from `notes-app/backend/`.

## One-time setup

1. Get a free API key: https://aistudio.google.com/apikey (sign in with any Google account,
   click "Create API key". This is the **AI Studio** free tier — no credit card, no billing
   required, just daily/per-minute limits that reset automatically).
2. Open `notes-app/backend/.env` and paste it in:
   ```
   GEMINI_API_KEY=your-key-here
   ```
3. Make sure your IP is allowed in MongoDB Atlas: Atlas → Network Access → Add IP Address →
   "Add Current IP Address" (better than 0.0.0.0/0 long-term since you'll run this from the
   same computer each time — it won't expire like a temporary entry does).

## Every time you have a new batch of screenshots

1. Put them all in one folder, e.g. `D:\coursenotes\css notes 2\`.
2. Generate the content (this calls Gemini, costs nothing, takes a few minutes for ~100+ images):
   ```
   cd notes-app/backend
   node scripts/generate-content.mjs "D:\coursenotes\css notes 2" "CSS Part 2" content.json
   ```
   - 2nd argument is the **module name** as it'll appear in the app.
   - 3rd argument is where to save the generated content — check it afterward if you're curious
     (open `content.json` in any editor) but you don't have to.
3. Import it into your database:
   ```
   node scripts/import-topics.mjs content.json --images-dir "D:\coursenotes\css notes 2" --course "web development"
   ```
   - `--course` must exactly match an existing course title in your app (case-insensitive).
     If you're starting a brand new subject, create the course first through the app's UI,
     then run this.
4. Refresh the app — the new module + topics + images + flashcards should be there.

## If something goes wrong

- **"Gemini returned 429"** — you've hit the free-tier rate limit. The script already retries
  automatically a few times; if it still fails, wait a few minutes (per-minute limits) or until
  tomorrow (daily limits) and re-run. It's safe to re-run — nothing gets written to the database
  until step 3.
- **"No course titled X found"** — check the exact course title in the app (Settings/dashboard),
  or create the course first.
- **MongoDB connection errors** — your IP probably isn't whitelisted in Atlas right now (see
  setup step 3), or the site's Atlas cluster is paused/asleep on the free tier.
- **The generated notes are mediocre for one topic** — open `content.json`, edit that topic's
  text by hand, save, then run the import step. It's a plain JSON file, easy to tweak before
  it touches your real data.

## Why this doesn't need Claude

`generate-content.mjs` talks directly to Google's Gemini API — same idea as what Claude did
manually for the CSS/JavaScript/React modules earlier (look at slides, write notes and
flashcards), just automated into a script you run yourself, for free, forever. You could also
point an agentic tool like Google's Antigravity, or a free Claude.ai chat, at this same folder
and ask it to do the categorizing by hand if you ever want a second opinion — the
`import-topics.mjs` script accepts any JSON file in the shape described in its header comment,
regardless of what produced it.
