import { io, type Socket } from 'socket.io-client'

// Un'unica connessione Socket.IO condivisa da tutta l'app (notifiche, stato online degli amici).
// Ogni componente chiama acquireSocket() e alla fine releaseSocket(): la connessione
// si chiude solo quando nessuno la usa più.
let socket: Socket | null = null
let users = 0

export function acquireSocket(): Socket {
	if (!socket) socket = io(window.location.origin, { withCredentials: true })
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
