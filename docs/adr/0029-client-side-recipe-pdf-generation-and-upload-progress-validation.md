# 0029: Client-Side Recipe PDF Generation and Upload Progress Validation

We decided to retain client-side printable recipe PDF generation via `jsPDF` rather than burdening backend resources with headless PDF rasterization, enforce dual-layer file validation with revised upload boundaries (10MB for images, 50MB for videos), implement deterministic upload progress tracking in the frontend via `XMLHttpRequest.upload.onprogress`, and triage server-side document attachments and headless PDF export under Feature Proposal #140.

## Context

1. **42 Common Core Subject Compliance**: The *File Upload and Management* module (Minor, 1 point) mandates:
   - *"Multiple file types (images, documents)"*
   - *"Upload progress indicators"*
   - *"Secure file storage with proper access control"*
2. **Backend Resource Preservation**: Generating printable PDFs on the server using headless browsers (Puppeteer, Chromium) or heavy Node.js canvas runtimes creates severe CPU/memory consumption and brings complex OS font/library dependencies into Docker containers. The frontend codebase already contains a working, highly localized client-side PDF export implementation in `src/frontend/src/lib/recipePdf.ts` utilizing `jsPDF`.
3. **Upload Progress Reporting**: When uploading multi-megabyte media assets (such as 50MB step demonstration videos or multi-photo galleries), users require clear visual feedback (0–100% progress indicators) to prevent accidental duplicate submissions or premature page navigation. The standard `fetch` API cannot track request body streaming progress in standard browser environments without unstable or non-standard ReadableStream features.
4. **Validation and Storage Integrity**: Open upload endpoints without strict size and MIME type guards expose the platform to denial-of-service via filesystem exhaustion. The legacy video upload limit (100MB) is disproportionate for short culinary tutorial clips.

## Decision

1. **Client-Side Recipe PDF Generation**:
   - Recipe PDF generation remains strictly on the client side using `src/frontend/src/lib/recipePdf.ts` with lazy-loaded `jsPDF`.
   - The client-side exporter dynamically renders localized recipe metadata, ingredient checkboxes, course/timing badges, and numbered preparation steps without backend API round-trips or server compute overhead.
   - Server-side headless PDF export is deferred as an optional extension.

2. **Dual-Layer Upload Validation & Payload Limits**:
   - **Allowed MIME Types & Max Boundaries**:
     - **Images** (`cover`, `step`, `gallery`, `avatar`): `image/jpeg`, `image/png`, `image/webp`. Maximum size: **10 MB** per file.
     - **Videos** (`video` tutorial): `video/mp4`, `video/webm`. Maximum size: **50 MB** per file (reduced from legacy 100MB limit).
   - **Client-Side Pre-Flight Validation**:
     - File inputs in recipe and avatar forms check `file.type` and `file.size` before initiating network transmission, halting invalid submissions with clear error messages.
   - **Server-Side Enforcement**:
     - Multer `fileFilter` verifies MIME types and extensions.
     - NestJS `ParseFilePipe` equipped with `FileTypeValidator` and `MaxFileSizeValidator` enforces boundary limits prior to handler execution, throwing `400 Bad Request` on violations.

3. **Client Upload Progress Tracking (`uploadWithProgress`)**:
   - In `src/frontend/src/api/client.ts`, implement an `uploadWithProgress<T>` utility wrapping `XMLHttpRequest` and listening to `xhr.upload.onprogress`.
   - Emit progress payloads `{ loaded: number, total: number, percent: number }` with percent clamped between 0 and 100.
   - Bind `uploadWithProgress` to UI progress indicators across `RecipeForm.tsx` (cover, gallery photos, and tutorial video) and avatar upload components in settings and profile views.

4. **Document Attachments and Server-Side PDF Tracking**:
   - Issue #140 (*Feature Proposal: Recipe PDF Document Upload Attachments & Headless PDF Export*) tracks the addition of culinary document attachments (`POST /api/recipes/:id/document`, max 10MB `application/pdf`) and a programmatic `GET /api/recipes/:id/pdf` endpoint using `pdfkit`.

## Consequences

- **Positive**:
  - Zero backend CPU or memory overhead for recipe PDF exports; operations execute instantaneously in the user's browser.
  - Video upload limits are reduced to 50MB, protecting container disk space and upload bandwidth.
  - Users receive granular, dynamic visual feedback during large file uploads via `xhr.upload.onprogress`.
  - Security is enforced at both the client boundary and server validation pipe.
- **Negative / Trade-offs**:
  - Non-browser programmatic consumers (e.g. cURL, command-line scripts) cannot directly download rendered recipe PDF cards via HTTP GET until Feature Proposal #140 is implemented.
