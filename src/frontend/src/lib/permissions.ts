import type { User } from '../types/models'

type Actor = Pick<User, 'id' | 'role'> | null | undefined

export const isAdmin = (u: Actor) => u?.role === 'admin'
export const isModerator = (u: Actor) => u?.role === 'moderator'
// moderatore o admin: vedono la coda delle segnalazioni
export const isStaff = (u: Actor) => isAdmin(u) || isModerator(u)

// modifica ricetta: proprietario o admin
export function canEditRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return Boolean(u && ((authorId != null && authorId === u.id) || isAdmin(u)))
}

// sospensione ricetta (DELETE /recipes/:id, soft delete): proprietario o staff.
// Il backend applica la gerarchia dei ruoli: un moderatore riceve 403 sulle ricette degli admin (ADR 0023).
export function canDeleteRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return Boolean(u && ((authorId != null && authorId === u.id) || isStaff(u)))
}

// riattivazione di una ricetta sospesa (PATCH { is_active: true }): proprietario o admin (non il moderatore)
export function canRestoreRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return canEditRecipe(u, authorId)
}

// eliminazione definitiva (?hard=true): solo admin
export const canPurge = (u: Actor) => isAdmin(u)

// disattivazione di un commento: autore del commento, autore della ricetta o staff
export function canDeactivateComment(
	u: Actor,
	commentAuthorId: number | null | undefined,
	recipeAuthorId: number | null | undefined,
): boolean {
	return Boolean(
		u && ((commentAuthorId != null && commentAuthorId === u.id) || (recipeAuthorId != null && recipeAuthorId === u.id) || isStaff(u)),
	)
}

// segnalare: serve essere loggati e non si segnalano i propri contenuti
export function canReport(u: Actor, ownerId: number | null | undefined): boolean {
	return Boolean(u && ownerId !== u.id)
}
