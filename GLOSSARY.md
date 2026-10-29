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
A predefined classification label representing dietary restrictions, occasions, or cooking styles.
_Avoid_: Keyword, label, hashtag

**TagTranslation**:
The localized name of a curated tag for a specific locale.
_Avoid_: Translated tag, tag label

**Unit of Measure**:
A standardized measurement unit spanning Metric, US Customary, and count systems.
_Avoid_: Measurement, size

**Source Language**:
The original canonical language declared and used by the author when composing the recipe.
_Avoid_: Default language, primary locale

**Translation Status**:
The lifecycle state (`completed` or `failed`) tracking automated machine translation via LibreTranslate.
_Avoid_: Translated flag, status code

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

**Friendship Status**:
The contextual relationship classification between a viewing user and a target member (`none`, `pending_sent`, `pending_received`, `friends`).
_Avoid_: Follow status, relation type, connection state

**Social Notification**:
An in-app alert and real-time event notifying a community member of an interaction (e.g. friend request, recipe like, or comment) directed at their content or account.
_Avoid_: Push message, ping, email, banner
