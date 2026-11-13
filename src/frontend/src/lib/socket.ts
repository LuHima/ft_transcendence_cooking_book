import { io, type Socket } from 'socket.io-client'

// A single Socket.IO connection shared by the whole app (notifications, friends' online status).
// Components call acquireSocket() and later releaseSocket(): the connection closes when nobody uses it.
let socket: Socket | null = null
let users = 0

export function acquireSocket(): Socket {
	if (!socket) socket = io(window.location.origin, { withCredentials: true, transports: ['websocket'] })
	users += 1
	return socket
}

export function releaseSocket() {
	users = Math.max(0, users - 1)
	if (users === 0 && socket) {
		socket.disconnect()
		socket = null
	}
}
