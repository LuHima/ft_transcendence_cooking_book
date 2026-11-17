import type { User } from '../types/models'

type Actor = Pick<User, 'id' | 'role'> | null | undefined

export const isAdmin = (u: Actor) => u?.role === 'admin'
export const isModerator = (u: Actor) => u?.role === 'moderator'
export const isStaff = (u: Actor) => isAdmin(u) || isModerator(u)

// Edit a recipe: author or admin
export function canEditRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return Boolean(u && ((authorId != null && authorId === u.id) || isAdmin(u)))
}

// Suspend a recipe (DELETE /recipes/:id, soft delete): author or staff (moderators cannot moderate admin recipes).
export function canDeleteRecipe(u: Actor, authorId: number | null | undefined, authorRole?: User['role'] | null): boolean {
	if (!u) return false
	if (authorId != null && authorId === u.id) return true
	if (isAdmin(u)) return true
	return isModerator(u) && authorRole !== 'admin'
}

// Reactivate a suspended recipe (PATCH { is_active: true }): staff only (moderators cannot moderate admin recipes).
export function canRestoreRecipe(u: Actor, authorRole?: User['role'] | null): boolean {
	if (!u) return false
	if (isAdmin(u)) return true
	return isModerator(u) && authorRole !== 'admin'
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
