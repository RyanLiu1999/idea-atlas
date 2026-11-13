# Idea Atlas

A personal idea network with an iOS-inspired interface, gently floating luminous points, quiet persistent names, hover previews and detailed source inspectors.

## Run

This is a buildless static application. Serve this directory with any static HTTP server. There are no package dependencies, API keys or server secrets.

## GitHub Pages

Publish the `main` branch, `/ (root)` directory in Settings → Pages. All asset and module paths are relative, so project Pages URLs work without a custom domain. `.nojekyll` preserves the static output.

## Features

- Luminous points with persistent gray labels and automatic label placement.
- Hover to pause and preview; click for details. On touch, tap to preview and tap again to open.
- Stable floating motion, pan/zoom, keyboard navigation and reduced-motion support.
- Manual idea editing, Markdown/TXT candidate imports, review inbox, local backups and JSON recovery.

## Data and current limits

Initial ideas and excerpts are demonstrations. All user content stays in the current browser's local storage. There is no shared database, cloud sync or model API. Markdown candidate extraction uses local heading rules; PDF selection only records filename/size and does not parse or upload content. The public repository contains application source and sample data only.

Different hosting origins have separate browser storage. To move existing ideas to GitHub Pages, export a JSON backup on the old origin if reachable, then import it on the new site. Clearing browser data removes local records.
