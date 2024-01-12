import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";

const app = express()
app.use(cors({
    origin: "http://localhost:5173"
}))

let rooms = {};

app.listen(9000, () => {
    console.log('connected')
})

function generateRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

app.get("/game", (req, res) => {
    console.log("game")
    let roomCode;

    do {
        roomCode = generateRandomString(5);
    } while (roomCode in rooms)

    rooms[roomCode] = { host: null, players: [] };
    res.json({roomCode: roomCode})
    console.log(Object.keys(rooms));
})

app.get("/join/:roomCode", (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    console.log(roomCode);
    
    let status = null;
    if (roomCode in rooms) {
        status = "good"
    } else {
        status = "noRoomCode"
    }
    res.json({status: status})
})

// Websocket

const io = new Server({
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET"]
    }
});
io.on("connection", (socket) => {
    console.log(`${socket.id} connected`)

    socket.on("disconnect", () => {
        console.log(`${socket.id} disconnected`)
    })

    socket.on("join_room_host", (data) => {

        // TODO send some message to clinet about connection success
        console.log(`data: ${JSON.stringify(data)}`)
        if (!(data.roomCode in rooms)) {
            socket.emit("join_status", {status: "fail"})
            return;
        }
        
        rooms[data.roomCode].host = socket;
        socket.emit("join_status", {status: "success"})
        // console.log("host", rooms[data.roomCode].host)
    })
    
    socket.on("join_room", (data) => {
        // TODO send some message to clinet about connection success
        if (!(data.roomCode in rooms)) {
            socket.emit("join_status", {status: "fail"})
            return;
        }
        rooms[data.roomCode].players.push(socket)
        console.log("players", rooms[data.roomCode].players)
        socket.emit("join_status", {status: "success"})
        socket.roomCode = data.roomCode;

        rooms[data.roomCode].host.emit("players_update", {players: rooms[data.roomCode].players.map(socket => socket.id)})
    })

    socket.on("close_room", (data) => {
        if (!(data.roomCode in rooms)) return;
        const roomToClose = rooms[data.roomCode];
        for (let player of roomToClose.players) {
            player.emit("room_close")
        }
        delete rooms[data.roomCode];
        console.log(Object.keys(rooms))
    })

    socket.on("disconnect", () => {
        if(!socket.roomCode || !(socket.roomCode in rooms)) return;
        rooms[socket.roomCode].players = rooms[socket.roomCode].players.filter(item => item != socket.id)
    })
})
io.listen(9091)