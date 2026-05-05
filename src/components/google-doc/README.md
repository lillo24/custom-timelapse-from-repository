# Google Doc Components

Status: `DRAFT` because this folder currently targets one static presentation frame and will likely change once timeline state is introduced.

This folder owns the fake editor UI used in the timelapse scene.

- `DocShell.tsx`: overall fake editor frame and split workspace/sidebar layout
- `DocTopBar.tsx`: top document title and lightweight toolbar strip
- `DocumentPage.tsx`: paper-like thesis page with sections, highlights, and margin comments
- `VersionHistorySidebar.tsx`: right rail showing milestone-like version entries
- `FakeTextBlock.tsx`: reusable fake paragraph line renderer
- `CommentBubble.tsx`: decorative margin note component
- `StatusPill.tsx`: small shared chip/pill primitive

These files are intentionally local to the presentation scene and are not meant to become a generic UI kit.
