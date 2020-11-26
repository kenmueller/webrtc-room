const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const { join } = require('path')

const PORT = process.env.PORT || '3000'

const app = express()
const server = createServer(app)
const io = new Server(server)

const rooms = {}

app.use(express.static(join(__dirname, '..', 'public')))

io.on('connect', socket => {
	const roomId = socket.handshake.query.room
	const room = rooms[roomId] = rooms[roomId] || {}
	
	socket.join(roomId)
	socket.to(roomId).emit('join', socket.id, false)
	
	for (const id in room)
		socket.emit('join', id, true)
	
	room[socket.id] = socket
	
	socket.on('ice-candidate', (id, candidate) => {
		socket.to(id).emit('ice-candidate', socket.id, candidate)
	})
	
	socket.on('session-description', (id, description) => {
		socket.to(id).emit('session-description', socket.id, description)
	})
	
	socket.on('disconnect', () => {
		socket.to(roomId).emit('leave', socket.id)
		delete room[socket.id]
	})
})

server.listen(PORT, () => {
	console.log(`Listening on http://localhost:${PORT}`)
})
