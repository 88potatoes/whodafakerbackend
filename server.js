import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import setUp from "./setup.json" assert {type: "json"};

// console.log(setUp)
const app = express()
app.use(cors({
    origin: setUp.ORIGIN
}))

let rooms = {};

app.listen(setUp.APP_PORT, () => {
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
    console.log(rooms[roomCode])

    let status = null;
    if (roomCode in rooms) {
        console.log("good")
        status = "good"
    } else {
        status = "noRoomCode"
    }
    res.json({status: status})
    console.log("sent")
})

// Websocket

const io = new Server({
    cors: {
        origin: setUp.ORIGIN,
        methods: ["GET"]
    }
});

function getRandomBoolArray(len, trues) {
    if (len-trues < 0) {
        console.log("invalid array length")
        return;
    }
    const arr = Array(trues).fill(true).concat(Array(len-trues).fill(false))

    // Fisher-Yates shuffle alg
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i+1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }

    return arr;
}

io.on("connection", (socket) => {
    console.log(`${socket.id} connected`)

    socket.on("join_room_host", (data) => {
        // TODO send some message to clinet about connection success
        // console.log(`data: ${JSON.stringify(data)}`)


        if (data.roomCode == null || !(data.roomCode in rooms)) {
            socket.emit("join_status", {status: "fail"})
            return;
        }
        
        rooms[data.roomCode].host = socket;
        socket.emit("join_status", {status: "success"})
        // console.log("host", rooms[data.roomCode].host)

        console.log("JOINHOST")
        console.log("ROOMCODE", data.roomCode)
        console.log("ROOM", rooms[data.roomCode])
    })
    
    socket.on("join_room", (data) => {
        // TODO send some message to clinet about connection success
        if (data.roomCode == null || !(data.roomCode in rooms)) {
            socket.emit("join_status", {status: "fail"})
            return;
        }
        console.log("JOIN")
        console.log("ROOMCODE", data.roomCode)
        console.log("ROOM", rooms[data.roomCode])
        socket.username = data.username;
        rooms[data.roomCode].players.push(socket)
        // console.log("players", rooms[data.roomCode].players)
        socket.emit("join_status", {status: "success"})
        socket.roomCode = data.roomCode;

        rooms[data.roomCode].host.emit("players_update", {players: rooms[data.roomCode].players.map(socket => socket.username)})
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

    socket.on("start_game", (data) => {
        //data: {word: string, nfakers: int, roomCode: string}
        if (data.roomCode == null || !(data.roomCode in rooms)) {
            console.log("something wrong with game start")
            return;
        }
        
        // get a randomised array
        console.log(`START GAME - Player Length ${rooms[data.roomCode].players.length} - nFakers ${data.nfakers}`)
        const randArr = getRandomBoolArray(rooms[data.roomCode].players.length, data.nfakers);
        console.log("randArr", randArr)
        // true => faker

        //overlay randArr on players
        for (let i = 0; i < randArr.length; i++) {
            rooms[data.roomCode].players[i].emit("start_game", {
                role: randArr[i] ? "faker" : "good", 
                word: randArr[i] ? null : data.word
            })
        }
    })

    socket.on("end_game", (data) => {
        if (data.roomCode == null || !rooms[data.roomCode]) return;
        rooms[data.roomCode].players.forEach(player => {
            player.emit("end_game")
        })
    })

    socket.on("disconnect", () => {
        console.log("disconnect", socket.id)
        if(!socket.roomCode || !(socket.roomCode in rooms)) return;
        rooms[socket.roomCode].players = rooms[socket.roomCode].players.filter(item => item.id != socket.id)
        rooms[socket.roomCode].host.emit("players_update", {players: rooms[socket.roomCode].players.map(socket => socket.username)})
    })
})
io.listen(setUp.WS_PORT)