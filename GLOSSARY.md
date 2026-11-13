# Transcendence Cooking Book

A full-stack culinary social network and recipe sharing platform with 3D interactive book presentation.

## Core Recipe Entities

**Recipe**:
The central entity representing a culinary dish, composed of cooking metadata, structured preparation steps, and curated ingredients.
_Avoid_: Dish, post, entry

**RecipeTranslation**:
A localized text projection of a recipe (title, description, preservation, tips) for a specific locale (Italian, English, French).
_Avoid_: Localized recipe, text copy

**RecipeStep**:
A discrete, ordered instruction step in a recipe with an optional duration (in minutes) and step-specific illustration. Step durations may exceed Total Recipe Time because preparation or cooking steps can run in parallel.
_Avoid_: Instruction, direction, step description

**Total Recipe Time**:
The overall wall-clock duration of a recipe, computed as the sum of preparation time and active cooking time.
_Avoid_: Step sum, cumulative step duration

**RecipeStepTranslation**:
The localized title and description of an instruction step for a specific locale.
_Avoid_: Localized step, step text

**Course**:
The dining classification of a recipe within a meal (appetizer, first_course, main_course, dessert, side_dish, drink, snack).
_Avoid_: Category, meal type, dish type

**Cover Image**:
The primary hero image representing the finished recipe on recipe cards, search results, and 3D book covers.
_Avoid_: Thumbnail, banner, avatar

**Recipe Gallery**:
A collection of up to 3 supplementary finished-dish photos showcasing plating and presentation.
_Avoid_: Photo album, media dump

**Tutorial Video**:
A single optional demonstration video attached to a recipe showcasing its execution.
_Avoid_: Clip, media, video tutorial, stream

**WebP Transcoding**:
The automated server-side transformation using Sharp that strips camera EXIF metadata, applies aspect-ratio-preserving bounding-box downscaling (max width 1920px, max height 1080px), and encodes recipe images (Cover Image, Recipe Step illustrations, Recipe Gallery) to WebP at quality 80 upon upload.
_Avoid_: Image conversion, photo shrink, raw upload

**Synchronous Video Compression**:
The in-request transcoding process using FFmpeg that compresses and standardizes uploaded tutorial videos into MP4 container format (H.264 video, AAC audio, CRF 27, preset fast, max 1920x1080 for horizontal videos and 1080x1920 for vertical videos without upscaling, and FastStart metadata optimization) before saving the media asset and returning the media URL to the client.
_Avoid_: Video convert, clip render, background transcode, raw video storage

**Preservation Notes**:
Guidance on how to store and preserve the prepared dish (shelf life in fridge/freezer, container advice).
_Avoid_: Storage, shelf life

**Author Tips**:
Practical advice, tricks, or ingredient substitutions provided by the recipe author.
_Avoid_: Notes, secrets, advice

**Ingredient**:
A curated, categorized culinary item referenced by recipes.
_Avoid_: Raw material, item, food

**IngredientTranslation**:
The localized name of a curated catalog ingredient for a specific locale.
_Avoid_: Translated ingredient, ingredient label

**RecipeIngredient**:
A join association linking a Recipe to a catalog Ingredient with an exact quantity, a standardized unit of measure, and optional localized preparation notes.
_Avoid_: Recipe component, ingredient line

**Tag**:
A curated dietary or nutritional attribute assigned to recipes or ingredients (e.g. vegetarian, vegan, gluten_free).
_Avoid_: Label, badge, category

**TagTranslation**:
The localized name of a curated tag for a specific locale.
_Avoid_: Translated tag, tag label

**Unit of Measure**:
A standardized culinary measurement unit (g, kg, ml, l, tbsp, tsp, piece, pinch).
_Avoid_: Quantity type, metric

**Source Language**:
The original canonical language declared and used by the author when composing the recipe.
_Avoid_: Default language, primary locale

**Translation Status**:
The lifecycle state (`completed` or `failed`) tracking automated machine translation via LibreTranslate.
_Avoid_: Translated flag, status code

**Recipe Projection**:
The dedicated process and module responsible for transforming raw relational recipe records and their localized translation tables into standardized, user-contextualized DTO projections (lightweight summary cards or comprehensive detail views) based on requested locale, author fallback rules, and viewer authentication state.
_Avoid_: Recipe mapper, DTO serializer, view builder, response formatter

**Printable Recipe PDF**:
A client-generated document containing localized culinary details, ingredients checklist, timing badges, and sequential preparation instructions rendered directly in the browser via `jsPDF` for printing or physical kitchen use.
_Avoid_: Server PDF, recipe sheet, print export

**Dual-Layer Upload Validation**:
The defensive verification pattern combining client-side pre-flight checks (inspecting file type and size before network transmission) with server-side Multer and NestJS ParseFilePipe enforcement to reject invalid or oversized media payloads.
_Avoid_: Form validation, file check

**Single-Resource Catalog Inspection**:
The public localized inspection endpoints (`GET /api/ingredients/:id` and `GET /api/tags/:id`) allowing clients to retrieve canonical definitions, category associations, and localized names for individual catalog entities without downloading whole dictionary catalogs.
_Avoid_: Catalog lookup, ingredient fetch, tag detail

## Social Interactions & Metrics

**Cumulative Likes**:
The total number of likes received across all recipes authored by a user.
_Avoid_: Total upvotes, overall score

**Recipe Comment**:
A public textual remark posted by an authenticated user on a recipe, either as a top-level thought or as a direct reply to an existing comment.
_Avoid_: Review, feedback, note, chat message, post reply

**Recipe Like**:
A positive endorsement registered by an authenticated user on a recipe, contributing to its cumulative social count and visibility.
_Avoid_: Upvote, favorite, bookmark, star

## Social & Friendship Entities

**Community Member**:
An active, registered user on the platform capable of authoring recipes, engaging in culinary discussions, and establishing friendships.
_Avoid_: Account, client, visitor, subscriber

**Friendship**:
A mutual, bidirectional social connection established between two authenticated users upon mutual consent.
_Avoid_: Follow, connection, contact, subscriber

**Friend Request**:
An invitation initiated by one user to another seeking to establish a mutual Friendship.
_Avoid_: Follow request, invitation, ping

**Friend Request Cooldown**:
A mandatory 30-day waiting period enforced after a friend request is rejected, preventing the rejected requester from sending new friend invitations to the same recipient during that interval.
_Avoid_: Block, ban, timeout, penalty

**Friendship Status**:
The contextual relationship classification between a viewing user and a target member (`none`, `pending_sent`, `pending_received`, `friends`).
_Avoid_: Follow status, relation type, connection state

**Culinary Profile**:
The public presentation of a community member showcasing their biographical note, culinary metrics, confirmed friends, and public recipes.
_Avoid_: Account page, user card, bio sheet

**Vanity Profile Route**:
A human-readable frontend URL path (`/u/:username`) that resolves a community member's Culinary Profile by username via `GET /api/users/by-username/:username` so shared profile links carry the member's username instead of an opaque database ID.
_Avoid_: Pretty link, custom slug, username redirect

**Culinary Bio**:
A brief self-written summary (up to 500 characters) describing a community member's cooking background, philosophy, or favorite cuisines.
_Avoid_: About me, description, user status

**Social Notification**:
An in-app alert and real-time event notifying a community member of an interaction (e.g. friend request, recipe like, or comment) directed at their content or account.
_Avoid_: Push message, ping, email, banner

**Notification Hydration**:
The process of augmenting notification entity records with rich actor profiles (username, avatar) and target summary metadata (recipe title, snippet) during retrieval to eliminate N+1 client queries.
_Avoid_: Population, expanding, joining, embedding

**Social Feed**:
A personalized, chronological stream of published recipes authored exclusively by a community member's confirmed friends.
_Avoid_: Wall, timeline, newsfeed, stream, home discovery

**User Block**:
A unilateral self-defense action initiated by a community member to enforce complete mutual invisibility and sever all social interactions with another account.
_Avoid_: Ban, blacklist, mute, restriction

**Content Report**:
A formal moderation flag submitted by an authenticated member against an offensive, abusive, or copyright-violating recipe, comment, or user.
_Avoid_: Flag, complaint, ticket, strike

**Moderation Queue**:
An administrative triage interface allowing platform moderators and administrators to inspect, review, and act upon pending content reports.
_Avoid_: Admin inbox, complaint list, report table

**Report Resolution**:
The formal triage decision (`dismiss`, `warn`, `delete_content`, `ban`) applied to a content report by a platform moderator or administrator, recording audit metadata and triggering corresponding safety enforcement.
_Avoid_: Report close, ticket solve, complaint resolution

## Platform Governance, Privacy & Security

**Recipe Privacy**:
The visibility classification of a culinary recipe (`public`, `friends_only`, `private`), dictating its appearance in global discovery, friend feeds, and author-only personal collections.
_Avoid_: Visibility flag, secret recipe, recipe access level

**Profile Privacy**:
The visibility classification of a community member's personal culinary profile (`public`, `friends_only`, `private`), controlling access to culinary bio, personal statistics, authored recipe archives, and friendship networks while preserving basic identity discovery.
_Avoid_: Account privacy, stealth mode, hidden user

**Degraded Profile**:
A contextual, privacy-filtered presentation of a culinary profile returned to non-friends or unauthorized callers, exposing essential identity markers (`id`, `username`, `avatar_url`, `bio`, `profile_privacy`) to facilitate social discovery and friend requests while withholding personal details and authored recipes.
_Avoid_: Partial profile, hidden profile, restricted user card

**Blended Recipe Search**:
The discovery mechanism on `GET /api/recipes` that returns public recipes alongside friends-only recipes authored by the caller's confirmed friends, ensuring full keyword searchability across the caller's social network while omitting inaccessible content.
_Avoid_: Combined search, friend search merge, hybrid query

**Audited Private Inspection**:
The administrative authorization policy allowing platform staff to view a private recipe or profile with mandatory audit logging, restricted to Administrators or to Moderators reviewing an active content report.
_Avoid_: Admin sneak peek, staff bypass, secret view

**Media Access Control**:
The authorization mechanism that gates binary media assets (cover images, step illustrations, gallery photos, tutorial videos, and recipe PDF sheets) against recipe privacy settings and mutual user block invariants.
_Avoid_: Static file serving, image gate, asset security

**HTTP Range Streaming**:
The RFC 9110 byte-range partial content delivery protocol (`HTTP 206 Partial Content`) used by the media gateway to stream recipe tutorial videos, enabling seeking, scrubber caching, and cross-browser playback across WebKit, Gecko, and Blink engines.
_Avoid_: Video dumping, progressive download, static video serving

**Account Ban**:
An administrative sanction applied to a community member's account, either temporary (capped at 180 days for moderators) or permanent (enforced by administrators), immediately invalidating active JWT sessions and restricting platform access.
_Avoid_: Account freeze, lockout, strike, kick

**Moderation Warning**:
An administrative notice issued by platform staff against reported content or accounts to alert an author of policy infractions and deliver corrective guidance without suspending account access or evicting sessions.
_Avoid_: Strike, informal warning, ping, slap on the wrist

**Anonymous Staff Notification**:
A platform-dispatched notification resulting from moderation actions (such as warnings) where staff identity is strictly masked (`actor: null`) to shield moderators and administrators from targeted harassment and retaliatory hostility while delivering official community feedback.
_Avoid_: Ghost alert, stealth notice, hidden author notification

**Report Actions Array**:
The explicit array of disciplinary choices (`actions: ReportAction[]`) persisted on a Content Report record, enforcing strict mutual exclusivity constraints (`dismiss` standalone, `warn` and `ban` mutually exclusive, composable with `delete_content`).
_Avoid_: Actions list, resolution flags, status tags

**Ban History**:
The immutable historical ledger recording all account suspensions, duration intervals, policy violation categories, user-facing explanations, and issuing staff identifiers for a community member, informing progressive discipline for repeat offenders.
_Avoid_: Ban log, strike history, black mark list

**Composite Resolution Action**:
A moderation triage decision that applies multiple disciplinary operations (such as simultaneously deactivating offending content and suspending the author's account) atomically in a single request.
_Avoid_: Multi-action, bulk resolution, double sanction

**Resolution Description**:
The user-facing textual explanation communicated to a penalized community member detailing the specific policy infraction (e.g. offensive imagery in recipe gallery) and providing the basis for account suspension or content deactivation.
_Avoid_: Ban reason, penalty note, warning text

**Comment Audit Queue**:
A centralized, flat chronological administrative stream allowing platform staff (administrators and moderators) to inspect, filter, and moderate comments and replies across all platform recipes.
_Avoid_: Comment feed, admin comment wall, message log

**Platform Custody Transfer**:
The administrative governance process of adopting public recipes into platform ownership (`owner_type: 'platform'`) upon user soft deletion to preserve valuable community content without attribution (`author: null`), while preserving the relational `user_id` to enable atomic, full content restoration upon account reactivation.
_Avoid_: Recipe confiscation, ghost author, deletion cascade

**Recipe Suspension**:
The non-destructive administrative or moderator deactivation of a culinary recipe (`is_active: false`), instantly hiding it from public discovery, search, author archives, and friend feeds while preserving its relational steps, ingredients, and media files for audit and appeal.
_Avoid_: Recipe takedown, hidden recipe, delete recipe

**Windowed Reply Preview**:
The pagination and presentation pattern where threaded comment listings return a truncated subset of child replies (e.g. 5 most recent) alongside total reply counts and pagination signals (`has_more_replies`), preventing payload bloat while maintaining discussion context.
_Avoid_: Child truncation, lazy comments, reply snippet

**Translation Provenance**:
The lifecycle classification of a localized recipe projection (`author_original`, `machine`, `manual`), explicitly identifying whether text was authored in the source language, synthesized by automated translation, or curated through human intervention.
_Avoid_: Translation author, translation tag, origin flag

**Administrative Recipe Stream**:
The dedicated administrative and staff recipe search and triage stream (`GET /api/admin/recipes`) guarded by `@Roles('admin', 'moderator')` supporting status filtering (`active`, `inactive`, `all`), text search, and catalog attributes, conforming to platform privacy visibility boundaries (Administrators access all privacy tiers; Moderators access public and friends-only recipes, plus private recipes only if actively reported).
_Avoid_: Admin recipe feed, backend recipe list, recipe manager

**Polymorphic Report Target Hydration**:
The contextual resolution process within the moderation queue (`GET /api/reports`) that augments report records with structured reporter identities and target-specific metadata (such as parent recipe IDs, preview snippets, usernames, and content owners) across heterogeneous report subjects (`recipe`, `comment`, `user`) to streamline staff triage without supplemental queries.
_Avoid_: Target expander, report populator, subject joining

**Reported Comments Audit Filter**:
The administrative triage query filter (`reported_only=true` on `GET /api/admin/comments`) that restricts the comment audit stream strictly to comments having active pending reports, prioritizing heavily reported items by default, signaling pending report counts, and guaranteeing inclusion of reported child replies in threaded previews.
_Avoid_: Flagged comment filter, dirty comments, report list

**Administrative Catalog Management**:
The dedicated administrative API namespace (`/api/admin/catalog`) and workflows restricted to administrators (`@Roles('admin')`) for creating, updating, inspecting full multilingual translation dictionaries, and deleting curated ingredients and tags.
_Avoid_: Catalog admin, tag manager, ingredient editor, public catalog CRUD

## API Governance & Documentation

**API Contract**:
The formal specification of HTTP endpoints, route parameters, payload schemas, and response status codes exposed by the backend, defined via the OpenAPI 3.0 specification.
_Avoid_: Endpoint list, API dump, route map

**Contract Drift**:
A discrepancy where backend controller implementations, validation pipes, or DTOs diverge from the published OpenAPI specification or Postman collections.
_Avoid_: Out-of-sync, desync, documentation lag

**Spec-to-Collection Synchronization**:
The deterministic local build and merge process that converts an OpenAPI specification into a Postman Collection v2.1.0 format using `openapi-to-postmanv2`, reconciles endpoint routes and payload schemas, and overlays Git-versioned test scripts and authentication hooks, before optionally updating the remote collection via Postman's free collection update API.
_Avoid_: Collection overwrite, collection import, spec replacement, Postman paid sync, cloud diff engine

**Headless Spec Generation**:
The process of compiling and extracting OpenAPI schemas directly from framework metadata and TypeScript reflection without initiating database connections or binding network sockets.
_Avoid_: App booting, live export, runtime dumping

**Query-Projection Decoupling**:
An architectural pattern where domain services retain control over database query criteria and relation selection, while delegating localization, formatting, and DTO shaping to a dedicated projection module.
_Avoid_: God repository, query mapper, fat service
