# 0023: Protected Media Access Control and HTTP 206 Range Video Streaming

We decided to eliminate open static asset serving (`app.useStaticAssets('/uploads')`) in favor of an authenticated `MediaModule` exposing hierarchical REST endpoints (`GET /api/media/recipes/:recipeId/:filename`, `GET /api/media/avatars/:userId/:filename`), enforce dynamic recipe privacy and mutual user block checks, implement RFC 9110 HTTP 206 Partial Content Range streaming for tutorial videos, and handle revalidation via `ETag` and `304 Not Modified`.

## Context

1. **42 Subject Compliance**: The *File Upload and Management* module (Minor, 1 point) mandates: *"Secure file storage with proper access control"*. Serving raw static files directly via Express (`/uploads/*`) allows any unauthenticated actor to bypass application authorization by guessing or obtaining direct file URLs.
2. **Recipe Privacy Invariant Integrity**: If a recipe is marked `private` or `friends_only`, its cover image, step photos, gallery, and video tutorial must not be accessible to unauthorized community members.
3. **Cross-Browser Video Playback**: WebKit (Safari on macOS/iOS) strictly rejects HTML5 `<video>` elements unless the backend supports `Accept-Ranges: bytes` and returns `206 Partial Content` with `Content-Range`. Chrome and Firefox also depend on Range requests to allow users to scrub/seek through cooking tutorials.
4. **Mutual User Block Privacy**: Users who have mutually blocked each other must not be able to view each other's avatars.
5. **External Avatar Invariant**: Profile avatars may originate from third-party OAuth providers (Google) or whitelisted CDNs, which must not be prefixed with local media route handlers.

## Decision

1. **Removal of Static Asset Middleware**:
   - Remove `app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' })` completely from `main.ts`.
   - Direct filesystem paths are inaccessible from the web; all asset delivery routes through `MediaController`.

2. **Hierarchical Media Endpoints (`MediaController`)**:
   - `GET /api/media/recipes/:recipeId/:filename`:
     - Checks `recipe.privacy`:
       - `public`: Accessible to everyone (unless author and viewer have a mutual user block).
       - `friends_only`: Caller must be authenticated and confirmed accepted friend (or author / admin). Otherwise returns `403 Forbidden` / `404 Not Found`.
       - `private`: Caller must be author (or admin under audit inspection). Otherwise returns `404 Not Found`.
   - `GET /api/media/avatars/:userId/:filename`:
     - Anonymous callers: Allowed to view (supports public recipe cards and user discovery).
     - Authenticated callers: Checks for an active `UserBlock` in either direction. If blocked, returns `404 Not Found`.

3. **RFC 9110 HTTP 206 Partial Content Streaming**:
   - For video files (`.mp4`, `.webm`):
     - If `req.headers.range` is present:
       - Parse byte boundaries `bytes=start-end`.
       - Respond with HTTP `206 Partial Content`.
       - Set `Content-Range: bytes ${start}-${end}/${fileSize}`, `Accept-Ranges: bytes`, `Content-Length: ${chunkSize}`, `Content-Type: video/mp4`.
       - Pipe `fs.createReadStream(filePath, { start, end })` to response.
     - If `Range` is omitted:
       - Respond with HTTP `200 OK`, `Accept-Ranges: bytes`, and stream full file.

4. **Upload URL Persistence & External Avatars**:
   - Upload handlers store and return canonical API paths (`/api/media/recipes/:recipeId/:filename` and `/api/media/avatars/:userId/:filename`).
   - If an avatar is an external URL (e.g. `https://lh3.googleusercontent.com/...`), preserve it without prepending the local media prefix.

5. **Revalidation & Caching**:
   - Send `ETag: W/"${fileSize}-${fileMtime}"` and `Cache-Control: private, no-cache`.
   - On incoming `If-None-Match`, evaluate access control first:
     - If authorized and ETag matches: return `304 Not Modified` with 0 bytes body.
     - If permissions were revoked or users blocked: return `403` or `404`.

## Consequences

- Completely seals the static file access vulnerability, fulfilling the 42 subject *File Upload and Management* access control requirement.
- Guarantees seamless video playback and timeline scrubbing across Safari, Firefox, and Chrome.
- Strictly enforces recipe privacy and mutual user blocks on all binary assets.
- Unblocks Ticket #85 (Recipe Printable PDF Generation & Multi-Format Document Upload).
