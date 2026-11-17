import { useEffect, useRef } from 'react'

// Open dialogs, innermost last: Escape and Tab trapping apply only to the top-most one (e.g. a ConfirmDialog over a ResolveDialog)
const openDialogs: number[] = []
let nextDialogId = 1

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getTopmostDialog(): HTMLElement | null {
	const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')
	return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => !el.matches(':disabled') && el.getClientRects().length > 0,
	)
}

// Document-level Escape, Tab focus trap, and focus restoration for custom modal dialogs.
// onClose may decide to ignore the request (e.g. while a request is in flight).
export function useDialogDismiss(onClose: () => void, enabled = true) {
	const onCloseRef = useRef(onClose)
	useEffect(() => {
		onCloseRef.current = onClose
	})

	useEffect(() => {
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
		return () => {
			if (previousFocus && previousFocus.isConnected) {
				previousFocus.focus()
			}
		}
	}, [])

	useEffect(() => {
		if (!enabled) return
		const id = nextDialogId++
		openDialogs.push(id)

		const rafId = window.requestAnimationFrame(() => {
			if (openDialogs[openDialogs.length - 1] !== id) return
			const dialog = getTopmostDialog()
			if (!dialog || dialog.contains(document.activeElement)) return
			const focusables = getFocusableElements(dialog)
			if (focusables.length > 0) {
				focusables[0].focus()
			} else {
				dialog.tabIndex = -1
				dialog.focus()
			}
		})

		function handleKeyDown(e: KeyboardEvent) {
			if (openDialogs[openDialogs.length - 1] !== id) return

			if (e.key === 'Escape') {
				e.preventDefault()
				// handled here: window-level shortcuts (e.g. the 3D book's Escape) must not react too
				e.stopPropagation()
				onCloseRef.current()
				return
			}

			if (e.key === 'Tab') {
				const dialog = getTopmostDialog()
				if (!dialog) return
				const focusables = getFocusableElements(dialog)
				if (focusables.length === 0) {
					e.preventDefault()
					return
				}
				const first = focusables[0]
				const last = focusables[focusables.length - 1]
				const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
				if (e.shiftKey) {
					if (!active || !dialog.contains(active) || active === first) {
						e.preventDefault()
						last.focus()
					}
				} else if (!active || !dialog.contains(active) || active === last) {
					e.preventDefault()
					first.focus()
				}
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => {
			window.cancelAnimationFrame(rafId)
			document.removeEventListener('keydown', handleKeyDown)
			const index = openDialogs.indexOf(id)
			if (index >= 0) openDialogs.splice(index, 1)
		}
	}, [enabled])
}
