import { useEffect, useState } from 'react'
import { acquireSocket, releaseSocket } from './socket'

// Insieme degli id degli amici online.
// Stato iniziale: il gateway risponde a 'getOnlineFriends'; poi si segue l'evento 'userStatus'.
export function useFriendsPresence(): Set<number> {
	const [online, setOnline] = useState<Set<number>>(() => new Set())

	useEffect(() => {
		const socket = acquireSocket()

		// va richiesto a ogni (ri)connessione, perché gli eventi persi durante una caduta non tornano
		const loadSnapshot = () => {
			socket.emit('getOnlineFriends', (res?: { userIds?: number[] }) => {
				setOnline(new Set(res?.userIds ?? []))
			})
		}
		const onUserStatus = (data: { userId: number; isOnline: boolean }) => {
			setOnline((prev) => {
				const next = new Set(prev)
				if (data.isOnline) next.add(data.userId)
				else next.delete(data.userId)
				return next
			})
		}

		socket.on('connect', loadSnapshot)
		socket.on('userStatus', onUserStatus)
		if (socket.connected) loadSnapshot()

		return () => {
			socket.off('connect', loadSnapshot)
			socket.off('userStatus', onUserStatus)
			releaseSocket()
		}
	}, [])

	return online
}
