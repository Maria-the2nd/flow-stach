# FUTURE

This document tracks ideas and planned enhancements that are not implemented yet, but are already partially wired in the codebase.

## Template Cover Images (Template Library)

### Current Behavior

- Templates are listed in the “All Templates” section of the assets page.
- Each template card is rendered by `TemplateCard` in `components/assets/AssetsContent.tsx`.
- The card background uses a static gradient:
  - `bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]`
- The `TemplateCard` component accepts an optional `imageUrl` prop:
  - When `imageUrl` is present, a Next.js `<Image>` is rendered on top of the gradient and effectively becomes the cover image.
- Template data comes from the `templates` table in Convex (`convex/schema.ts`):
  - Fields include `name`, `slug`, `imageUrl?`, `createdAt`, `updatedAt`.
- The template list query (`api.templates.listWithCounts`) returns each template, and the UI passes `template.imageUrl` into `TemplateCard`.

**Result:** if `imageUrl` is set for a template, the template card already shows a real cover image instead of just the gradient. However, there is no built-in way in the UI to upload or manage that image.

### Gaps / Not Implemented Yet

1. No admin UX to edit `imageUrl` for a template.
   - There is no “edit cover” button or modal on the template cards.
   - There is no admin form that lists templates and lets you set/clear `imageUrl`.
2. No storage backend for binary uploads.
   - The app does not currently integrate with a storage provider (Cloudinary, S3, Convex file storage, etc.) for image files.
   - There is no API route or upload handler that accepts an image, stores it, and returns a public URL.
3. No Convex mutation dedicated to cover image changes.
   - There is a `templates.rename` mutation for names, but not a mutation like `templates.setImageUrl`.

### Intended UX (Future)

Goal: allow an admin to quickly replace a template’s gradient thumbnail with a custom cover image from the UI.

High-level flow:

1. On the “All Templates” grid, each template card shows a small “edit cover” icon when the user is an admin.
2. Clicking the icon opens a modal for that template.
3. Inside the modal, the admin can:
   - Either paste a public image URL and save.
   - Or upload an image file from disk (once a storage provider is configured).
4. On save:
   - The client calls a Convex mutation (e.g. `api.templates.setImageUrl`) with `{ templateId, imageUrl }`.
   - The mutation updates `templates.imageUrl` and bumps `updatedAt`.
5. The “All Templates” view re-renders using the updated `imageUrl`, so the cover image replaces the gradient background visually.

This UX should be restricted to admin users based on existing admin detection (email allowlist via `NEXT_PUBLIC_ADMIN_EMAILS`).

### Minimal Implementation (URL-Only)

This version does not handle actual file upload. It assumes the image is already hosted somewhere (Webflow assets, Cloudinary, S3, etc.) and only needs to store the URL.

Proposed steps:

1. Add a Convex mutation:
   - `api.templates.setImageUrl({ templateId, imageUrl })`
   - Validates:
     - Caller is admin (using `requireAdmin`).
     - `imageUrl` is either an empty string (to clear) or a non-empty string.
   - Writes to `templates.imageUrl` and updates `updatedAt`.
2. Extend the admin tooling for templates:
   - In `DatabasePanel` or a new admin component:
     - List templates with a small “Edit cover” button.
     - Clicking opens a simple dialog containing:
       - Text input for the image URL.
       - “Save” and “Clear image” actions.
   - On save/clear:
     - Call `setImageUrl` mutation.
3. Rely on existing UI behavior:
   - `TemplateCard` will automatically show the image on the “All Templates” page if `imageUrl` is set.

This gives immediate value without committing to a specific file storage provider.

### Full Upload Flow (Future-Future)

If/when a storage provider is chosen, the full upload flow would look like this:

1. Choose a storage provider:
   - Cloudinary (likely simplest: upload from the client and receive a optimized URL).
   - S3/other object storage (requires signed URLs and an API route).
   - Convex file storage (if the project wants to keep everything under Convex).
2. Implement an upload endpoint:
   - Option A: Next.js API route (`app/api/uploads/route.ts`) that:
     - Validates auth and admin status.
     - Accepts multipart form-data or a base64 payload.
     - Uploads to the storage provider.
     - Returns a public URL to the client.
   - Option B: Direct browser upload using provider’s SDK with a signed upload URL.
3. Wire the modal to the upload:
   - Add a file input inside the “Edit cover” modal.
   - On file selection:
     - Call the upload endpoint or SDK.
     - Receive a public URL.
     - Call `templates.setImageUrl` with the new URL.
4. Optional:
   - Add constraints (max file size, aspect ratio, allowed formats).
   - Add basic validation on the backend and front-end error messages.

### Constraints / Design Notes

- The front-end is already safe to render arbitrary URLs in `Next/Image` when using the custom `loader={({ src }) => src}` and `unoptimized`. However, using a trusted domain (e.g. Cloudinary) is recommended for security and performance.
- The gradient background should remain as a fallback (for templates with no `imageUrl`), so the UI still looks good when a cover image has not been set.
- Template cover images are purely visual metadata:
  - They do not affect any Webflow payloads or import/export behavior.
  - They are only used in the template library UI to give a more branded presentation.

