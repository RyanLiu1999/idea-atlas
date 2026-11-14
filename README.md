# Idea Atlas

A personal research and idea network with an iOS inspired interface, a full-viewport, softly glowing multi-center galaxy, quiet persistent names, hover previews and complete local source documents.

Live site: https://ryanliu1999.github.io/idea-atlas/

## Run

This is a buildless static application. Serve this directory with any static HTTP server. There are no package dependencies, API keys or server secrets.

## GitHub Pages

Publish the `main` branch, `/ (root)` directory in Settings → Pages. All asset and module paths are relative, so project Pages URLs work without a custom domain. `.nojekyll` preserves the static output.

## Features

- A midnight blue canvas with soft stardust and diffuse lights. Every idea is illuminated normally; hovering or focusing one star highlights it and dims all others, including its neighbors.
- Hover to pause and preview; click for details. On touch, tap to preview and tap again to open.
- Weighted modularity finds deterministic exploratory layout groups, without forcing a cluster count. Several high-degree local centers can coexist; satellites orbit the weighted equilibrium of their neighbors and local hubs. Hubs drift slowly instead of rotating around one canvas origin. Homogeneous complete graphs remain one group.
- Stars without a direct edge in the complete working graph repel more strongly at close range. Bounded, distance-decaying repulsion separates groups while their connected centers keep satellites together. Search and the visible-edge slider never redefine whether a physical edge exists. Missing a direct edge is a layout condition, not evidence of semantic unrelatedness.
- Degree increases both mass and gravity. Stronger matches within a group have stiffer attraction and shorter ideal distances. Cross-group bridges keep their original scores but use weaker layout attraction, a longer distance floor and subtler lines so groups remain distinguishable. Global distance is not a similarity scale; groups are not verified semantic classifications.
- The star field fills the viewport by default. Click the persistent menu/search buttons or hover the left/top edge to reveal glass overlay controls. Search shortcuts, touch controls, focus restoration and Escape work without resizing the canvas; hidden controls are inert.
- Connection count alone determines star size and brightness. Metrics and physics use the complete working collection's 30+ similarity suggestions, independent of search, category filters and the visible-edge slider. The graph combines each idea's top three qualifying neighbors.
- Pan/zoom, keyboard navigation and reduced-motion support. Hover/selection freezes the target while other stars continue; explicit pause, background tabs and reading dialogs stop simulation. Labels update at a limited rate and retain their placements when possible.
- Saved x/y values remain spatial anchors. Animation never persists its positions or velocities; dragging explicitly saves an anchor, and pinning keeps a star still during simulation. A responsive viewport resize remaps normalized spatial coordinates, including pinned positions. Existing original documents and workspace schema are unchanged.
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

`import-engine.mjs` extracts report structure and source evidence; `ingest.mjs` stages File objects without persisting or mutating a workspace; `workspace-store.mjs` manages transactions and backup validation; `document-view.mjs` safely renders text; `relations.mjs` calculates explainable suggestions; `galaxy.mjs` implements bounded deterministic physics and connection metrics; `motion.mjs` and `point-field.js` handle the camera, labels and interaction; `shell.mjs` manages the immersive overlay controls.

The physical solver is bounded to 500 dynamic bodies and 4,000 edges by default. Larger libraries retain all documents and ideas; excess points remain available as static points and in the list. Initial relaxation has a fixed pair-work budget. This is a two dimensional visual layout, not an embedding or a physical measurement of semantic truth.
