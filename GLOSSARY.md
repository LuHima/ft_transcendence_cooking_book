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
A discrete, ordered instruction step in a recipe with an optional duration and step-specific illustration.
_Avoid_: Instruction, direction, step description

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

## Platform Governance, Privacy & Security

**Recipe Privacy**:
The visibility classification of a culinary recipe (`public`, `friends_only`, `private`), dictating its appearance in global discovery, friend feeds, and author-only personal collections.
_Avoid_: Visibility flag, secret recipe, recipe access level

**Profile Privacy**:
The visibility classification of a community member's personal culinary profile (`public`, `friends_only`, `private`), controlling access to culinary bio, personal statistics, authored recipe archives, and friendship networks while preserving basic identity discovery.
_Avoid_: Account privacy, stealth mode, hidden user

**Media Access Control**:
The authorization mechanism that gates binary media assets (cover images, step illustrations, gallery photos, tutorial videos, and recipe PDF sheets) against recipe privacy settings and mutual user block invariants.
_Avoid_: Static file serving, image gate, asset security

**Account Ban**:
An administrative sanction applied to a community member's account, either temporary (capped at 90 days for moderators) or permanent (enforced by administrators), immediately invalidating active JWT sessions and restricting platform access.
_Avoid_: Account freeze, lockout, strike, kick

**Comment Audit Queue**:
A centralized, flat chronological administrative stream allowing platform staff (administrators and moderators) to inspect, filter, and moderate comments and replies across all platform recipes.
_Avoid_: Comment feed, admin comment wall, message log

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
