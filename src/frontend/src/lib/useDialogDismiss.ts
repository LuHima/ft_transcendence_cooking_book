import { useEffect, useRef } from 'react'

// Open dialogs, innermost last: Escape only closes the top-most one (e.g. a ConfirmDialog over a ResolveDialog)
const openDialogs: number[] = []
let nextDialogId = 1

// Document-level Escape for custom dialogs: works whatever element has focus (even outside the dialog).
// onClose may decide to ignore the request (e.g. while a request is in flight).
export function useDialogDismiss(onClose: () => void, enabled = true) {
	const onCloseRef = useRef(onClose)
	useEffect(() => {
		onCloseRef.current = onClose
	})

	useEffect(() => {
		if (!enabled) return
		const id = nextDialogId++
		openDialogs.push(id)
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key !== 'Escape' || openDialogs[openDialogs.length - 1] !== id) return
			e.preventDefault()
			// handled here: window-level shortcuts (e.g. the 3D book's Escape) must not react too
			e.stopPropagation()
			onCloseRef.current()
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			const index = openDialogs.indexOf(id)
			if (index >= 0) openDialogs.splice(index, 1)
		}
	}, [enabled])
}
