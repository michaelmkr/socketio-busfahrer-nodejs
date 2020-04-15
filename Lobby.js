const Game = require('./Game.js');

class Lobby {

    constructor(id, nsp) {
        this.id = id;
        this.nsp = nsp;
        this.game = new Game();
    }

    listen(){
        const game = this.game;
        const nsp = this.nsp;
        game.init();
        nsp.on('connection', (socket) => {

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
                socket.emit('update-player-info', player);
                updatePlayerInfos();
                usersChanged('joined');
                console.log(nsp.clients().server.connected)
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
                socket.emit('update-player-info', player);
                updatePlayerInfos();
                const playersReady = game.checkIfPlayersAreReady();
                if (playersReady) {
                    game.nextRound();
                    nsp.emit('game-round-changed');
                }
            });

            socket.on('player-get-options', () => {
                game.setCountGetOptionsRequests = game.getCountGetOptionsRequests + 1;
                if (game.getCountGetOptionsRequests === game.Players.length) {
                    game.setCountGetOptionsRequests = 0;
                    switchUpdateRoundOptions();
                    if (game.getRound !== 5 && game.getRound !== 7) {
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
                    nsp.emit('card-was-drawn', {
                        uuid: socket.id,
                        name: socket.username,
                        chosenOption: chosenOption,
                        drawnCard: card,
                        wasRight: playerWasRight
                    });
                    socket.emit('update-player-info', player);
                    updatePlayerInfos();
                } else if (game.getRound === 6) {
                    card = game.addCardToPack();
                    const answer = game.checkCardType(card, socket.id);
                    if (chosenOption === answer) {
                        playerWasRight = true;
                        player.setRound7RightCardCount = player.getRound7RightCardCount + 1;
                    }
                    nsp.emit('card-was-drawn', {
                        uuid: socket.id,
                        name: socket.username,
                        chosenOption: chosenOption,
                        drawnCard: card,
                        wasRight: playerWasRight
                    });
                    socket.emit('update-player-info', player);
                    updatePlayerInfos();
                    if (playerWasRight && player.getCards().length > 0 && player.getRound7RightCardCount < player.getCards().length) {
                        setTimeout(() => {
                            promptNextPlayer();
                        }, 8000);
                    } else if (playerWasRight && player.getCards().length > 0 && player.getRound7RightCardCount === player.getCards().length) {
                        player.hasFinished();
                        updatePlayerInfos();
                        game.advancePlayerInLine();
                        setTimeout(() => {
                            promptNextPlayer();
                        }, 8000);
                    } else if (!playerWasRight || player.getCards().length === 0) {
                        nsp.emit('round6-slug-count', player.getRound7RightCardCount + 1);
                        player.setRound7RightCardCount = 0;
                        game.advancePlayerInLine();
                        setTimeout(() => {
                            promptNextPlayer();
                        }, 8000);
                    }
                }
            });

            socket.on('busdriver-chose-option', (cardIndex) => {
                if (game.checkIfCardIndexIsValid(cardIndex)) {
                    const card = game.addCardToPack();
                    const cardNumber = game.getCardNumber(card.charAt(1));
                    let playerWasRight = false;
                    console.log(cardNumber);
                    if (cardNumber < 10) {
                        playerWasRight = true;
                        game.setBusdriverRound = game.getBusdriverRound + 1;
                    }
                    nsp.emit('drivercard-was-drawn', {
                        uuid: socket.id,
                        name: socket.username,
                        chosenOption: cardIndex,
                        drawnCard: card,
                        wasRight: playerWasRight,
                        slugCounter: game.getBusdriverRound + 1
                    });
                    if (game.getBusdriverRound === 4 && playerWasRight) {
                        nsp.emit('game-is-finished');
                    }
                    if (!playerWasRight) {
                        game.setBusdriverRound = 0;
                    }
                }
            });

            socket.on('busdriver-start-over', () => {
                updateRound7Options()
            });

            socket.on('prompt-next-player', () => {
                console.log("PROMPTING NEXT PLAYER");
                game.advancePlayerInLine();
                if (game.getCurrentPlayer < game.Players.length) {
                    promptNextPlayer();
                } else if (game.getCurrentPlayer === game.Players.length) {
                    game.nextRound();
                    nsp.emit('game-round-changed');
                }
            });

            socket.on('kicked-players-turn', () => {
                if (game.readyCount < this.Players.length) {
                    game.setReadyCount = game.readyCount + 1;
                } else if (game.readyCount === this.Players.length) {
                    promptNextPlayer();
                    game.setReadyCount = 0;
                }
            });

            function updatePlayerInfos() {
                nsp.emit('update-player-list', game.Players);
            }

            function usersChanged(event) {
                nsp.emit('users-changed', {user: socket.username, event: event});
            }

            function reconnectPlayer(uuid) {
                console.log("user-id " + uuid + " reconnected");

                game.setPlayerKillable(uuid, false);
                game.changeUserStatus(uuid, 'ready');

                let player = game.getPlayerInfo(uuid);
                socket.id = uuid;
                socket.username = player.name;
                console.log("user reconnected as " + socket.username);
                socket.emit('update-player-info', player);
                updatePlayerInfos();
                usersChanged('reconnected');
                switchUpdateRoundOptions();
                if (game.getCurrentPlayer === game.getPlayerIndex(uuid) && game.getRound > 0 && game.getRound !== 5) {
                    promptNextPlayer();
                }
            }

            function killPlayer(uuid) {
                if (game.isPlayerKillable(uuid)) {
                    game.removePlayer(uuid);
                    console.log('Player ' + uuid + ' killed');
                    usersChanged('killed');
                    updatePlayerInfos();
                    if (game.getRound > 0 && game.getCurrentPlayer > 0 && game.getCurrentPlayer !== game.Players.length) {
                        game.setCurrentPlayer = game.getCurrentPlayer - 1;
                    } else if (game.getRound > 0 && game.getCurrentPlayer > 0 && game.getCurrentPlayer === game.Players.length) {
                        game.setCurrentPlayer = 0;
                    }
                } else {
                    console.log('Player was not killed. ' + uuid + ' reconnected in time or has already been killed');
                }
            }

            function updateRoundOptions(option1, option2) {
                console.log("updating round options now" + socket.id);
                nsp.emit('update-round-options', {
                    option1: option1,
                    option2: option2,
                    roundNumber: game.getRound,
                });
            }

            //TODO fires too soon
            function promptNextPlayer() {
                if (game.getRound < 5) {
                    const playerId = game.getNextPlayerInLine();
                    nsp.emit('player-prompt-interaction', playerId);
                } else if (game.getRound === 6 && game.checkForBusdriver() === '') {
                    if (game.getCurrentPlayer < game.Players.length) {
                        const playerId = game.getNextPlayerInLine();
                        const player = game.getPlayerInfo(playerId);
                        if (player.getCards().length > 0) {
                            nsp.emit('player-prompt-interaction', playerId);
                        } else if (player.getCards().length === 0) {
                            game.advancePlayerInLine();
                            promptNextPlayer()
                        }
                    } else if (game.getCurrentPlayer === game.Players.length) {
                        game.setCurrentPlayer = 0;
                        const playerId = game.getNextPlayerInLine();
                        const player = game.getPlayerInfo(playerId);
                        if (player.getCards().length > 0) {
                            nsp.emit('player-prompt-interaction', playerId);
                        } else if (player.getCards().length === 0) {
                            game.advancePlayerInLine();
                            promptNextPlayer()
                        }
                    }
                    // TODO something here is missing
                } else if (game.getRound === 6 && game.checkForBusdriver() !== '') {
                    console.log('Busdriver is: ' + game.checkForBusdriver());
                    game.nextRound();
                    nsp.emit('game-round-changed');
                } else if (game.getRound === 7) {
                    const playerId = game.checkForBusdriver();
                    nsp.emit('player-prompt-interaction', playerId);
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
                            game.setCurrentPlayer = 0;
                            game.nextRound();
                            nsp.emit('game-round-changed');
                        }
                        break;
                    case 6:
                        updateRoundOptions('Rot', 'Schwarz');
                        break;
                    case 7:
                        updateRound7Options();
                        break;
                }
            }

            function updateRound5Options() {
                nsp.emit('update-round5-options', {
                    roundNumber: game.getRound,
                    drawnCard: game.addCardToPack(),
                });
            }

            function updateRound7Options() {
                nsp.emit('update-busdriver-options', {
                    roundNumber: game.getRound,
                    drivingRound: game.getBusdriverRound,
                    busdriver: game.Busdriver,
                    message: 'Und von vorne..',
                });
            }

        });
    }



}

module.exports = Lobby;
