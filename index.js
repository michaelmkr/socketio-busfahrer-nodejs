const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

const Game = require('./Game.js');

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

const game = new Game();
game.init();

io.on('connection', (socket) => {

    socket.on('user-connect', (uuid) => {
        if (game.checkIfPlayerExists(uuid)) {
            reconnectPlayer(uuid);
        } else {
            socket.id = uuid;
            usersChanged('connected');
        }
    });

    socket.on('user-set-name', (name) => {
        socket.username = name;
        console.log("user-id " + socket.id + " joined the game as user " + socket.username);
        game.addPlayer(socket.id, name);
        let player = game.getPlayerInfo(socket.id);
        io.emit('update-player-info', player);
        updatePlayerInfos();
        usersChanged('joined');
    });

    socket.on('disconnect', function () {
        console.log("user-id " + socket.id + " disconnected");
        if (game.checkIfPlayerExists(socket.id)) {
            console.log("user " + socket.username + " left the game");
            game.changeUserStatus(socket.id, 'away');
            usersChanged('left');
            updatePlayerInfos();
            game.setPlayerKillable(socket.id, true);
            setTimeout(killPlayer, game.getSuicideTimeout, socket.id);
        }
    });

    socket.on('user-is-ready', () => {
        game.changeUserStatus(socket.id, 'ready');
        let player = game.getPlayerInfo(socket.id);
        io.emit('update-player-info', player);
        updatePlayerInfos();
        const playersReady = game.checkIfPlayersAreReady();
        if (playersReady) {
            game.nextRound();
            io.emit('game-round-changed');
        }
    });

    // TODO debounce
    socket.on('player-get-options', () => {
        game.setCountGetOptionsRequests = game.getCountGetOptionsRequests + 1;
        if (game.getCountGetOptionsRequests === game.Players.length) {
            game.setCountGetOptionsRequests = 0;
            switch (game.getRound) {
                case 0: // JOINING PHASE
                    break;
                case 1: // ROT ODER SCHWARZ
                    updateRoundOptions('Rot', 'Schwarz');
                    promptNextPlayer();
                    break;
                case 2: // DRUNTER ODER DRÜBER
                    updateRoundOptions('Drunter', 'Drüber');
                    promptNextPlayer();
                    break;
                case 3: // INNEN ODER AUßEN
                    updateRoundOptions('Innerhalb', 'Außerhalb');
                    promptNextPlayer();
                    break;
                case 4: // hab ich, hab ich nicht
                    updateRoundOptions('Hab ich', 'Hab ich nicht');
                    promptNextPlayer();
                    break;
            }
        }
    });

    socket.on('player-chose-option', (chosenOption) => {
        const card = game.addCardToPlayer(socket.id);
        const answer = game.checkCardType(card, socket.id);
        let playerWasRight = false;
        if (chosenOption === answer){
            playerWasRight = true;
        }
        io.emit('card-was-drawn', {
            uuid: socket.id,
            name: socket.username,
            chosenOption: chosenOption,
            drawnCard: card,
            wasRight: playerWasRight
        });
        let player = game.getPlayerInfo(socket.id);
        io.emit('update-player-info', player);
        updatePlayerInfos();
    });

    socket.on('prompt-next-player', () => {
        console.log("PROMPTING NEXT PLAYER");
        game.advancePlayerInLine();
        if (game.getCurrentPlayer < game.Players.length) {
            promptNextPlayer();
        } else if (game.getCurrentPlayer === game.Players.length) {
            game.nextRound();
            io.emit('game-round-changed');
        }
    });

    // TODO GIT Repository


    function updatePlayerInfos() {
        io.emit('update-player-list', game.Players);
    }

    function usersChanged(event) {
        io.emit('users-changed', {user: socket.username, event: event});
    }

    function reconnectPlayer(uuid) {
        console.log("user-id " + uuid + " reconnected");

        game.setPlayerKillable(uuid, false);
        game.changeUserStatus(uuid, 'online');

        let player = game.getPlayerInfo(uuid);
        socket.id = uuid;
        socket.username = player.name;
        console.log("user reconnected as " + socket.username);
        io.emit('update-player-info', player);
        updatePlayerInfos();
        usersChanged('reconnected');
        switch (game.getRound) {
            case 0: // JOINING PHASE
                break;
            case 1: // ROT ODER SCHWARZ
                updateRoundOptions('Rot', 'Schwarz');
                break;
            case 2: // DRUNTER ODER DRÜBER
                updateRoundOptions('Drunter', 'Drüber');
                break;
            case 3: // INNEN ODER AUßEN
                updateRoundOptions('Innerhalb', 'Außerhalb');
                break;
            case 4: // hab ich, hab ich nicht
                updateRoundOptions('Hab ich', 'Hab ich nicht');
                break;
        }
    }

    function killPlayer(uuid) {
        if (game.isPlayerKillable(uuid)) {
            game.removePlayer(uuid);
            console.log('Player ' + uuid + ' killed');
            usersChanged('killed');
            updatePlayerInfos();
            if (game.getCurrentPlayer > 0 && game.getRound > 0) {
                game.setCurrentPlayer = game.getCurrentPlayer - 1
            }
        } else {
            console.log('Player was not killed. ' + uuid + ' reconnected in time or has already been killed');
        }
    }

    function updateRoundOptions(option1, option2) {
        console.log("updating round options now" + socket.id);
        io.emit('update-round-options', {
            option1: option1,
            option2: option2,
            roundNumber: game.getRound,
        });
    }

    function promptNextPlayer() {
        const playerId = game.getNextPlayerInLine();
        io.emit('player-prompt-interaction', playerId);
    }
});


http.listen(port, function () {
    console.log('listening on *:' + port);
});
