import type { User } from '../types/models'

type Actor = Pick<User, 'id' | 'role'> | null | undefined

export const isAdmin = (u: Actor) => u?.role === 'admin'
export const isModerator = (u: Actor) => u?.role === 'moderator'
export const isStaff = (u: Actor) => isAdmin(u) || isModerator(u)

// Edit a recipe: author or admin
export function canEditRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return Boolean(u && ((authorId != null && authorId === u.id) || isAdmin(u)))
}

// Suspend a recipe (DELETE /recipes/:id, soft delete): author or staff.
// The backend enforces the role hierarchy: moderators get 403 on admin recipes (ADR 0023).
export function canDeleteRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return Boolean(u && ((authorId != null && authorId === u.id) || isStaff(u)))
}

// Reactivate a suspended recipe (PATCH { is_active: true }): author or admin, not moderators
export function canRestoreRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return canEditRecipe(u, authorId)
}

// Permanent deletion (?hard=true): admins only
export const canPurge = (u: Actor) => isAdmin(u)

// Deactivate a comment: comment author, recipe author or staff
export function canDeactivateComment(
	u: Actor,
	commentAuthorId: number | null | undefined,
	recipeAuthorId: number | null | undefined,
): boolean {
	return Boolean(
		u && ((commentAuthorId != null && commentAuthorId === u.id) || (recipeAuthorId != null && recipeAuthorId === u.id) || isStaff(u)),
	)
}

// Reporting requires being signed in, and users cannot report their own content
export function canReport(u: Actor, ownerId: number | null | undefined): boolean {
	return Boolean(u && ownerId !== u.id)
}
