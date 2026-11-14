# Idea Atlas

A personal research and idea network with an iOS inspired interface, slowly floating soft lights, quiet persistent names, hover previews and complete local source documents.

Live site: https://ryanliu1999.github.io/idea-atlas/

## Run

This is a buildless static application. Serve this directory with any static HTTP server. There are no package dependencies, API keys or server secrets.

## GitHub Pages

Publish the `main` branch, `/ (root)` directory in Settings → Pages. All asset and module paths are relative, so project Pages URLs work without a custom domain. `.nojekyll` preserves the static output.

## Features

- Soft diffuse lights with persistent gray labels and automatic label placement.
- Hover to pause and preview; click for details. On touch, tap to preview and tap again to open.
- Stable floating motion, pan/zoom, keyboard navigation and reduced-motion support.
- Long Markdown/TXT reports become one idea per document, with all original text retained independently of the editable summary. Generic section titles get a suggested topical title; unknown attributes remain unknown.
- Local title, extractive summary, domain, mechanism, scenario and keyword suggestions include excerpts as their extraction basis. Import directly with a review status, or use the inbox.
- Same contents under another filename are skipped using a fingerprint plus normalized full-text comparison. Different contents sharing one filename remain separate. User edits are never replaced on reimport.
- Full-text search, a source reader with real heading outline, in-document find, raw Markdown and original download. Tables, formulas and code remain readable; Mermaid is not executed and images are not fetched.
- Limit: 5 MB per Markdown/TXT file, 25 MB per JSON backup; at most 50 files and 25 MB per batch. Each file receives a success, duplicate or error result. PDF content parsing is not implemented; unsupported files are rejected explicitly.
- Similarity suggestions use corpus weighted shared terms and valid attributes. Placeholder values do not score. The graph combines each idea's top three qualifying neighbors. Scores do not imply endorsement, contradiction or causation.
- IndexedDB atomically stores original documents and graph data. Valid v1 localStorage records migrate without removing the original copy. Read/validation failures enter a protected recovery view instead of overwriting data.
- Complete v2 JSON backups include source documents, ideas, inbox, recoverable removed items and layout. Backups are validated before merge; repeated recovery is idempotent, and v1 backups remain supported.

## Data and current limits

Imported documents remain in the current browser. No document, title, summary, telemetry or embedding is uploaded to GitHub or a model service. The public repository contains generic application code and demonstration ideas only. Demonstration content is hidden after real reports are imported and can be toggled separately.

Extraction is a transparent local heuristic, not a language model or research fact checker. Review the suggested attributes and hypotheses before treating them as confirmed knowledge. There is no cloud sync, authentication, vector search, scientific citation verification or typeset mathematics engine.

Different hosting origins have separate browser storage. To move existing ideas to GitHub Pages, export a JSON backup on the old origin if reachable, then import it on the new site. Clearing browser data removes local records.

## Modules

`import-engine.mjs` extracts report structure and source evidence; `ingest.mjs` stages File objects without persisting or mutating a workspace; `workspace-store.mjs` manages transactions and backup validation; `document-view.mjs` safely renders text; `relations.mjs` calculates explainable suggestions; `motion.mjs` and `point-field.js` control visual motion.
