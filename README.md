# vortex1.dev

My portfolio site, hosted on GitHub Pages.

## Editing from the site

Click **Edit site** in the footer and sign in (username `vortex1`). Then:

- **Projects:** "New project" on the home page; "Edit project" on any project page. Upload photos, pick the cover, reorder, edit specs, details, links and the write-up, or delete the project.
- **Build log:** "New entry" on the build log page, "Add log entry" on a project page, "Edit entry" under any entry.
- **Editing on / off** in the bar at the bottom hides the edit buttons so you can see the page as visitors do.

Each save is one commit to `main`. GitHub Pages republishes about a minute later; while signed in you see the new version right away.
Photos are resized to 1600 px JPEGs in the browser and saved to `media/work/` (projects) or `media/log/` (log entries).

### The login server

Sign-in goes through a Cloudflare Worker (`editor-worker/worker.js`, deployed as `vortex1-editor` on the route `vortex1.dev/editor-api/*`).
It checks the password, holds the GitHub key, and only lets the editor change `data/*.json` and photos in `media/`.
After 5 wrong passwords from one address (or 30 total) sign-in locks for an hour.

- **Change the password:** Cloudflare → Workers → vortex1-editor → Settings → Variables and Secrets → edit `EDITOR_PASSWORD`. Every device gets signed out.
- **GitHub key expired:** make a new fine-grained key (only this repo, Contents: read and write) and replace `GITHUB_TOKEN` there.
- **Update the server code:** paste `editor-worker/worker.js` into the worker's code editor and deploy.

## Editing by hand

- **A project:** add an object to `projects` in `data/projects.json`. `sort` (YYYY-MM) sets the order, `featured: true` puts it in Selected work.
- **A build log entry:** add an object to `data/log.json` (id, date, project slug, title, hours, text, photos). Entries are written in my own words.
- **A changelog line:** add it at the top of `changelog.html`.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Home: hero, selected work, full project index, latest log entries |
| `project.html?p=slug` | One page per project, built from `data/projects.json` |
| `log.html` | The build log |
| `about.html` | About me and the tools I use |
| `school.html`, `frc.html`, `gcode-simulator.html`, `account.html`, `changelog.html` | Interactive pages |
| `site.css` | Design tokens and layout for every page |
| `tools.css` | Extra styles for the interactive pages |
| `site.js` | Renders projects, the build log and the photo viewer |
| `admin.js`, `admin.css` | The editor (only loads after you click Edit site or are signed in) |
| `editor-worker/worker.js` | The login server (Cloudflare Worker) |
| `data/projects.json`, `data/log.json` | All project and build log content |
| `404.html` | Sends old links like `/sao-many-saos` to the right project page |
