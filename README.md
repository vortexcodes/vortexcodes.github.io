# vortex1.dev

My portfolio site, hosted on GitHub Pages.

## Adding things

- **A project:** add a block to `data/projects.js` and put its photos in `media/work/`. Set `featured: true` to show it under Selected work on the home page.
- **A build log entry:** add an entry to `data/log.js` (date, project slug, title, hours, text, photos). Put photos in `media/log/`. Entries are written in my own words.
- **A changelog line:** add it at the top of `changelog.html`.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Home: hero, selected work, full project index, latest log entries |
| `project.html?p=slug` | One page per project, built from `data/projects.js` |
| `log.html` | The build log |
| `about.html` | About me and the tools I use |
| `school.html`, `frc.html`, `gcode-simulator.html`, `account.html`, `changelog.html` | Interactive pages |
| `site.css` | Design tokens and layout for every page |
| `tools.css` | Extra styles for the interactive pages |
| `site.js` | Renders projects, the build log and the photo viewer |
| `404.html` | Sends old links like `/sao-many-saos` to the right project page |
