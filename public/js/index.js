const ROOM_ID = '/'
const STREAM_CONSTRAINTS = {
	audio: true,
	video: true
}
const CONNECTION_CONFIG = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' }
	]
}

const socket = io({
	query: { room: ROOM_ID }
})
const connections = {}

const localStreamFnQueue = []
let localStream

const getLocalStream = fn => {
	localStream
		? fn(localStream)
		: localStreamFnQueue.push(fn)
}

const setLocalStream = stream => {
	localStream = stream
	
	for (const fn of localStreamFnQueue)
		fn(stream)
}

navigator.mediaDevices.getUserMedia(STREAM_CONSTRAINTS)
	.then(stream => {
		setLocalStream(stream)
		document.getElementById('local-video').srcObject = stream
	})
	.catch(error => {
		alert(error.message)
		console.error(error)
	})

socket.on('join', async (id, createOffer) => {
	if (id in connections)
		return
	
	const connection = connections[id] = new RTCPeerConnection(CONNECTION_CONFIG)
	
	connection.onicecandidate = ({ candidate }) => {
		if (!candidate)
			return
		
		socket.emit('ice-candidate', id, {
			sdpMLineIndex: candidate.sdpMLineIndex,
			candidate: candidate.candidate
		})
	}
	
	connection.ontrack = ({ streams: [stream] }) => {
		if (!stream)
			return
		
		const element = document.createElement('video')
		
		element.id = id
		element.autoplay = true
		element.srcObject = stream
		
		document.getElementById('videos').append(element)
	}
	
	getLocalStream(localStream => {
		for (const track of localStream.getTracks())
			connection.addTrack(track, localStream)
	})
	
	if (!createOffer)
		return
	
	const localDescription = await connection.createOffer()
	await connection.setLocalDescription(new RTCSessionDescription(localDescription))
	
	socket.emit('session-description', id, localDescription)
})

socket.on('ice-candidate', async (id, candidate) => {
	const connection = connections[id]
	
	if (connection)
		await connection.addIceCandidate(new RTCIceCandidate(candidate))
})

socket.on('session-description', async (id, remoteDescription) => {
	const connection = connections[id]
	
	if (!connection)
		return
	
	await connection.setRemoteDescription(new RTCSessionDescription(remoteDescription))
	
	if (remoteDescription.type !== 'offer')
		return
	
	const localDescription = await connection.createAnswer()
	await connection.setLocalDescription(new RTCSessionDescription(localDescription))
	
	socket.emit('session-description', id, localDescription)
})

socket.on('leave', id => {
	const connection = connections[id]
	const element = document.getElementById(id)
	
	if (connection)
		connection.close()
	
	if (element)
		element.remove()
	
	delete connections[id]
})
