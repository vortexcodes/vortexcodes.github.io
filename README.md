# vortex1.dev

My portfolio site, hosted on GitHub Pages.

## Editing from the site

Go to **vortex1.dev/login** (or click **Edit site** in the footer).

- **First time:** paste a GitHub key (fine-grained token, this repo only, Contents: read and write; the sign-in box links to a pre-filled form) and pick a password.
- **After that, on any browser:** just type the password.
- **Password** in the bar at the bottom changes the password or turns password sign-in off.

The password locks the GitHub key with PBKDF2 + AES-GCM and saves the locked copy to `data/login.json`. That file is public, so use a long password you don't use anywhere else. If the key expires (GitHub keys last up to a year), sign in with a new key and set the password again. If the password ever leaks, delete the key on GitHub (Settings → Developer settings → Fine-grained tokens) and it stops working right away.

Once signed in:

- **Projects:** "New project" on the home page; "Edit project" on any project page. Upload photos, pick the cover, reorder, edit specs, details, links and the write-up, or delete the project.
- **Star / Hide:** buttons under each project in the home page list and on each project page. Starred projects show in Selected work. Hidden projects (and their log entries) disappear from the public site; you still see them, marked Hidden, while signed in. Hidden only means not shown: the text is still in the public `data/projects.json`.
- **Build log:** "New entry" on the build log page, "Add log entry" on a project page, "Edit entry" under any entry.
- **Editing on / off** in the bar at the bottom hides the edit buttons so you can see the page as visitors do.

Each save is one commit to `main`. GitHub Pages republishes about a minute later; while signed in you see the new version right away.
Photos are resized to 1600 px JPEGs in the browser and saved to `media/work/` (projects) or `media/log/` (log entries).

## Editing by hand

- **A project:** add an object to `projects` in `data/projects.json`. `sort` (YYYY-MM) sets the order, `featured: true` puts it in Selected work, `hidden: true` keeps it off the public site.
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
| `data/projects.json`, `data/log.json` | All project and build log content |
| `data/login.json` | The editor's GitHub key, locked with the password (only there once a password is set) |
| `login/` | vortex1.dev/login, opens the editor sign-in |
| `404.html` | Sends old links like `/sao-many-saos` to the right project page |
