import { useEffect, useState } from 'react'

// anteprima locale di un File; l'URL viene revocato quando il file cambia o il componente si smonta
export function useObjectUrl(file: File | null): string | null {
	const [url, setUrl] = useState<string | null>(null)
	useEffect(() => {
		if (!file) return
		const objectUrl = URL.createObjectURL(file)
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setUrl(objectUrl)
		return () => {
			URL.revokeObjectURL(objectUrl)
			setUrl(null)
		}
	}, [file])
	return file ? url : null
}
