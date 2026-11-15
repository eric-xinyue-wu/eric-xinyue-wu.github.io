# Xinyue Wu · personal site

A single static page: `index.html`, `styles.css`, `main.js`. No build step, no dependencies.

- The panel in the hero is a small inventory-based market-making simulation (see the top of `main.js`).
- All copy lives in `index.html`. The résumé PDF is `assets/Xinyue_Wu_Resume.pdf`; replace the file to update it.
- Fonts load from Google Fonts (Newsreader, Geist, Geist Mono) with system fallbacks.

## Preview locally

```bash
python3 -m http.server 8140
```

## Deploy

Push to a repository named `<name>.github.io` and enable GitHub Pages on the `main` branch (root).
