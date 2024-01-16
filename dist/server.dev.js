"use strict";

var _express = _interopRequireDefault(require("express"));

var _cors = _interopRequireDefault(require("cors"));

var _socket = require("socket.io");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var app = (0, _express["default"])();
app.use((0, _cors["default"])({
  origin: "http://localhost:5173"
}));
var rooms = {};
app.listen(9000, function () {
  console.log('connected');
});

function generateRandomString(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

app.get("/game", function (req, res) {
  console.log("game");
  var roomCode;

  do {
    roomCode = generateRandomString(5);
  } while (roomCode in rooms);

  rooms[roomCode] = {
    host: null,
    players: []
  };
  res.json({
    roomCode: roomCode
  });
  console.log(Object.keys(rooms));
});
app.get("/join/:roomCode", function (req, res) {
  var roomCode = req.params.roomCode.toUpperCase();
  console.log(roomCode);
  var status = null;

  if (roomCode in rooms) {
    status = "good";
  } else {
    status = "noRoomCode";
  }

  res.json({
    status: status
  });
}); // Websocket

var io = new _socket.Server({
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET"]
  }
});

function getRandomBoolArray(len, trues) {
  if (len - trues < 0) {
    console.log("invalid array length");
    return;
  }

  var arr = Array(trues).fill(true).concat(Array(len - trues).fill(false)); // Fisher-Yates shuffle alg

  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var _ref = [arr[j], arr[i]];
    arr[i] = _ref[0];
    arr[j] = _ref[1];
  }

  return arr;
}

io.on("connection", function (socket) {
  console.log("".concat(socket.id, " connected"));
  socket.on("join_room_host", function (data) {
    // TODO send some message to clinet about connection success
    // console.log(`data: ${JSON.stringify(data)}`)
    if (data.roomCode == null || !(data.roomCode in rooms)) {
      socket.emit("join_status", {
        status: "fail"
      });
      return;
    }

    rooms[data.roomCode].host = socket;
    socket.emit("join_status", {
      status: "success"
    }); // console.log("host", rooms[data.roomCode].host)

    console.log("JOINHOST");
    console.log("ROOMCODE", data.roomCode);
    console.log("ROOM", rooms[data.roomCode]);
  });
  socket.on("join_room", function (data) {
    // TODO send some message to clinet about connection success
    if (data.roomCode == null || !(data.roomCode in rooms)) {
      socket.emit("join_status", {
        status: "fail"
      });
      return;
    }

    console.log("JOIN");
    console.log("ROOMCODE", data.roomCode);
    console.log("ROOM", rooms[data.roomCode]);
    socket.username = data.username;
    rooms[data.roomCode].players.push(socket); // console.log("players", rooms[data.roomCode].players)

    socket.emit("join_status", {
      status: "success"
    });
    socket.roomCode = data.roomCode;
    rooms[data.roomCode].host.emit("players_update", {
      players: rooms[data.roomCode].players.map(function (socket) {
        return socket.username;
      })
    });
  });
  socket.on("close_room", function (data) {
    if (!(data.roomCode in rooms)) return;
    var roomToClose = rooms[data.roomCode];
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = roomToClose.players[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var player = _step.value;
        player.emit("room_close");
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator["return"] != null) {
          _iterator["return"]();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    delete rooms[data.roomCode];
    console.log(Object.keys(rooms));
  });
  socket.on("start_game", function (data) {
    //data: {word: string, nfakers: int, roomCode: string}
    if (data.roomCode == null || !(data.roomCode in rooms)) {
      console.log("something wrong with game start");
      return;
    } // get a randomised array


    console.log("START GAME - Player Length ".concat(rooms[data.roomCode].players.length, " - nFakers ").concat(data.nfakers));
    var randArr = getRandomBoolArray(rooms[data.roomCode].players.length, data.nfakers);
    console.log("randArr", randArr); // true => faker
    //overlay randArr on players

    for (var i = 0; i < randArr.length; i++) {
      rooms[data.roomCode].players[i].emit("start_game", {
        role: randArr[i] ? "faker" : "good",
        word: randArr[i] ? null : data.word
      });
    }
  });
  socket.on("end_game", function (data) {
    if (data.roomCode == null || !rooms[data.roomCode]) return;
    rooms[data.roomCode].players.forEach(function (player) {
      player.emit("end_game");
    });
  });
  socket.on("disconnect", function () {
    console.log("disconnect", socket.id);
    if (!socket.roomCode || !(socket.roomCode in rooms)) return;
    rooms[socket.roomCode].players = rooms[socket.roomCode].players.filter(function (item) {
      return item.id != socket.id;
    });
    rooms[socket.roomCode].host.emit("players_update", {
      players: rooms[socket.roomCode].players.map(function (socket) {
        return socket.id;
      })
    });
  });
});
io.listen(9091);