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

// eliminazione ricetta: proprietario o admin. Il moderatore elimina solo dalle segnalazioni (pannello Moderazione),
// perché può agire solo su ricette segnalate.
export function canDeleteRecipe(u: Actor, authorId: number | null | undefined): boolean {
	return canEditRecipe(u, authorId)
}

// segnalare: serve essere loggati e non si segnalano i propri contenuti
export function canReport(u: Actor, ownerId: number | null | undefined): boolean {
	return Boolean(u && ownerId !== u.id)
}
