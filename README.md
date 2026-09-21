# Daily Edition

A personal daily news page, built to feel like a newspaper: assembled every
morning, topped up through the day, organized into sections by interest.

Sections: **Chess**, **World & Politics**, **Springboks** (SA rugby), **Proteas**
(SA cricket).

## How it works

- `scripts/feeds.mjs` lists the RSS feeds for each section.
- `scripts/build.mjs` fetches those feeds, picks the 5 newest articles per
  section, extracts a summary + image where available, and writes
  `docs/data.json`.
- `docs/` is a plain static site (`index.html` / `style.css` / `app.js`) that
  reads `docs/data.json` and renders the cards. It's published via GitHub
  Pages from the `main` branch's `docs/` folder.
- `.github/workflows/update-news.yml` runs `scripts/build.mjs` on a schedule
  (06:00, 09:00, 12:00, 15:00, 18:00, 21:00 SAST) and commits the refreshed
  `docs/data.json`, so the page updates itself with no server to run.

## Local development

Requires [Node.js](https://nodejs.org) 20+ (not required just to view the
site — GitHub Actions builds it for you once deployed).

```
npm install
npm run build      # writes docs/data.json from the live feeds
```

Then serve `docs/` locally to preview, e.g.:

```
npx http-server docs
```

## Changing sections or feeds

Edit `scripts/feeds.mjs` — each section is a `{ id, title, feeds: [...] }`
entry. A feed can carry an optional `keywords` array to filter a broad feed
down to just what's relevant (used for the rugby/cricket sections, which pull
from general feeds and filter for South Africa). Section order in
`scripts/feeds.mjs` controls the order sections appear on the page.

To add a whole new section, add an entry to `sections` in `feeds.mjs` — no
other code changes needed.

## Deploying

1. Push this repo to GitHub.
2. In the repo's Settings → Pages, set the source to the `main` branch,
   `/docs` folder.
3. The `Update Daily Edition` workflow runs on its schedule automatically; you
   can also trigger it manually from the Actions tab (`workflow_dispatch`).
4. On an iPad, open the Pages URL in Safari and use Share → **Add to Home
   Screen** for an app-like icon and full-screen feel.
