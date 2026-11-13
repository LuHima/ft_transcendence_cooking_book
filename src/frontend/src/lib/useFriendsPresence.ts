import { useEffect, useState } from 'react'
import { acquireSocket, releaseSocket } from './socket'

// Set of online friends' IDs.
// Initial state comes from 'getOnlineFriends', then the 'userStatus' event keeps it updated.
export function useFriendsPresence(): Set<number> {
	const [online, setOnline] = useState<Set<number>>(() => new Set())

	useEffect(() => {
		const socket = acquireSocket()

		// Requested on every (re)connection, because events missed while disconnected are not replayed
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
