# Notes for Claude: Emma & Alisa's site

Emma and Alisa are friends of Jones (who owns this repo). They're vibe coding their own website here, so they may not know HTML or git. Do the work, explain what you changed in a sentence or two of plain words, and give them the link to look at.

## Where things go

- **Everything lives in this folder.** It's served at **https://vortex1.dev/emma-and-alisa/**; `index.html` is their home page. Add pages, CSS, JS and images here (e.g. `emma-and-alisa/about.html`, `emma-and-alisa/images/`).
- **Don't change anything outside `emma-and-alisa/`**, even if they ask. The rest of the repo is Jones's portfolio. If they need something outside this folder, tell them to ask Jones.
- **Keep it self-contained.** Don't use `../site.css`, `../site.js`, `/data/...` or other files from Jones's site; they change without warning. Link files with relative paths (`style.css`, `images/cat.jpg`) or with `/emma-and-alisa/...`, never a bare `/` path.
- A missing page under `/emma-and-alisa/` sends visitors back to their home page (handled by the repo's `404.html`).

## How it goes live

- It's GitHub Pages: plain files, no build step, no server. HTML, CSS and browser JS only; libraries from a CDN with a pinned version (e.g. `cdn.jsdelivr.net/npm/three@0.160.0`).
- Pages also runs Jekyll: file or folder names starting with `_` are skipped, and pages should be `.html`, not `.md`.
- Commit on your branch, open a PR titled `Emma & Alisa: <what changed>`, then merge it yourself (see the root `CLAUDE.md`). The site updates about a minute after the merge; if they still see the old version, tell them to hard-refresh.

## Keep them safe

- The repo and the site are **public**. Don't put last names, home addresses, phone numbers, school names, passwords or API keys in any file, and check with them before adding photos of people.
- Resize photos before adding them (about 1600 px on the long side, under 1 MB each) so the repo stays small.
- Make every page work on a phone.
