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
        game.addCardToPlayer(socket.id);
        game.addCardToPlayer(socket.id);
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

    socket.on('player-get-options', () => {
        game.setCountGetOptionsRequests = game.getCountGetOptionsRequests + 1;
        if (game.getCountGetOptionsRequests === game.Players.length) {
            game.setCountGetOptionsRequests = 0;
            switchUpdateRoundOptions();
            if (game.getRound !== 5) {
                promptNextPlayer();
            }
        }
    });

    socket.on('player-chose-option', (chosenOption) => {
        let player = game.getPlayerInfo(socket.id);
        let playerWasRight = false;
        let card;
        if (game.getRound < 6) {
            if (game.getRound < 5) {
                card = game.addCardToPlayer(socket.id);
                const answer = game.checkCardType(card, socket.id);
                if (chosenOption === answer) {
                    playerWasRight = true;
                }
            } else if (game.getRound === 5) {
                card = game.getLastDrawnCard;
                playerWasRight = game.checkCardType(chosenOption, socket.id);
            }
            io.emit('card-was-drawn', {
                uuid: socket.id,
                name: socket.username,
                chosenOption: chosenOption,
                drawnCard: card,
                wasRight: playerWasRight
            });
            io.emit('update-player-info', player);
            updatePlayerInfos();
        } else if (game.getRound === 6) {
            card = game.addCardToPack();
            const answer = game.checkCardType(card, socket.id);
            if (chosenOption === answer) {
                playerWasRight = true;
                player.getCards().pop();
            }
            io.emit('card-was-drawn', {
                uuid: socket.id,
                name: socket.username,
                chosenOption: chosenOption,
                drawnCard: card,
                wasRight: playerWasRight
            });
            io.emit('update-player-info', player);
            updatePlayerInfos();
            if (playerWasRight && player.getCards().length > 0) {
                setTimeout(() => {
                    promptNextPlayer();
                }, 8000)
            } else {
                game.advancePlayerInLine();
                promptNextPlayer();
            }
        }
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
        switchUpdateRoundOptions();
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
        if (game.getRound < 6) {
            const playerId = game.getNextPlayerInLine();
            io.emit('player-prompt-interaction', playerId);
        } else if (game.getRound === 6 && game.checkForBusdriver() === '') {
            if (game.getCurrentPlayer < game.Players.length) {
                const playerId = game.getNextPlayerInLine();
                const player = game.getPlayerInfo(playerId);
                if (player.getCards().length > 0) {
                    io.emit('player-prompt-interaction', playerId);
                }
            } else if (game.getCurrentPlayer === game.Players.length) {
                game.setCurrentPlayer = 0;
                const playerId = game.getNextPlayerInLine();
                const player = game.getPlayerInfo(playerId);
                if (player.getCards().length > 0) {
                    io.emit('player-prompt-interaction', playerId);
                }
            }
        } else if (game.getRound === 6 && game.checkForBusdriver() !== '') {
            console.log('Busdriver is: ' + game.checkForBusdriver());
            game.nextRound();
            io.emit('game-round-changed');
        }
    }

    function switchUpdateRoundOptions() {
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
            case 5: // H
                if (game.getRound5CardCount < 9) {
                    updateRound5Options();
                    game.setRound5CardCount = game.getRound5CardCount + 1;
                    console.log('round 5 card count: ' + game.getRound5CardCount);
                } else if (game.getRound5CardCount === 9) {
                    game.nextRound();
                    io.emit('game-round-changed');
                }
                break;
            case 6:
                updateRoundOptions('Rot', 'Schwarz');
                break;
            case 7:
                console.log('EIN HOCH AUF UNSERN BUSFAHRER');
                updateRound7Options();
                break;
        }
    }

    function updateRound5Options() {
        io.emit('update-round5-options', {
            roundNumber: game.getRound,
            drawnCard: game.addCardToPack(),
        });
    }

    function updateRound7Options() {
        console.log('Ein Hoch auf unsern Busfahrer');
        io.emit('busdriver-was-chosen');
    }

});


http.listen(port, function () {
    console.log('listening on *:' + port);
});
