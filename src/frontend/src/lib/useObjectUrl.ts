import { useEffect, useState } from 'react'

// Local preview of a File; the URL is revoked when the file changes or the component unmounts
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
