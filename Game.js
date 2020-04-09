const Player = require('./Player.js');

class Game {

    standardDeck = [
        'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h8', 'h9', 'hx', 'hb', 'hq', 'hk', 'ha',
        'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd8', 'd9', 'dx', 'db', 'dq', 'dk', 'da',
        'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c8', 'c9', 'cx', 'cb', 'cq', 'ck', 'ca',
        's2', 's3', 's4', 's5', 's6', 's7', 's8', 's8', 's9', 'sx', 'sb', 'sq', 'sk', 'sa',
    ];
    cardDeck = [];
    cardPack = [];
    Players = [];
    _round = 0;
    _currentPlayer = 0;
    _suicideTimeout = 60000;
    _countGetOptionsRequests = 0;

    constructor() {
    }

    _readyCount = 0;

    get readyCount() {
        return this._readyCount;
    }

    get getRound() {
        return this._round;
    }

    set setRound(value) {
        this._round = value;
    }

    set setReadyCount(value) {
        this._readyCount = value;
    }

    get getCurrentPlayer() {
        return this._currentPlayer;
    }

    set setCurrentPlayer(value) {
        this._currentPlayer = value;
    }

    get getSuicideTimeout() {
        return this._suicideTimeout;
    }

    set setSuicideTimeout(value) {
        this._suicideTimeout = value;
    }

    get getCountGetOptionsRequests() {
        return this._countGetOptionsRequests;
    }

    set setCountGetOptionsRequests(value) {
        this._countGetOptionsRequests = value;
    }

    shuffle(array) {
        array.sort(() => Math.random() - 0.5);
    }

    init() {
        this.cardDeck = this.cardDeck.concat(this.standardDeck, this.standardDeck);
        this.shuffle(this.cardDeck);
    }

    logStuff() {
        console.log("Card Deck: " + this.cardDeck);
        console.log("Players: " + JSON.stringify(this.Players));
        console.log("Drawn Cards: " + this.cardPack)
    }

    addPlayer(uuid, name) {
        this.Players = this.Players.concat(new Player(uuid, name));
    }

    removePlayer(uuid) {
        const playerIndex = this.Players.findIndex(item => item.getUuid() === uuid);
        this.Players.splice(playerIndex, 1);
    }

    nextRound() {
        this.setRound = this.getRound + 1;
        this.setCurrentPlayer = 0;
        console.log("RUNDE NUMMER " + this.getRound);
    }

    drawCard() {
        const randomPosition = Math.floor(Math.random() * this.cardDeck.length);
        const card = this.cardDeck[randomPosition];
        this.cardDeck.splice(randomPosition, 1);
        return card;
    }

    addCardToPlayer(playerId) {
        const card = this.drawCard();
        const playerIndex = this.Players.findIndex(item => item.getUuid() === playerId);
        this.Players[playerIndex].addCard(card);
        return card;
    }

    addCardToPack() {
        const card = this.drawCard();
        this.cardPack.push(this.drawCard(card));
        return card;
    }

    addAnotherCardDeck() {
        this.cardDeck = this.cardDeck.concat(this.standardDeck);
    }

    getPlayerInfo(uuid) {
        const playerIndex = this.Players.findIndex(item => item.getUuid() === uuid);
        return this.Players[playerIndex];
    }

    checkIfPlayerExists(uuid) {
        const playerIndex = this.Players.findIndex(item => item.getUuid() === uuid);
        if (playerIndex > -1) {
            return true;
        } else if (playerIndex === -1) {
            return false;
        }
    }

    isPlayerKillable(uuid) {
        const playerIndex = this.Players.findIndex(item => item.getUuid() === uuid);
        const player = this.Players[playerIndex];
        if (player) {
            return !!player.getKillable;
        }
    }

    setPlayerKillable(uuid, killable) {
        const player = this.getPlayerInfo(uuid);
        player.setKillable = killable;
    }

    getPlayerIndex(uuid) {
        return this.Players.findIndex(item => item.getUuid() === uuid);
    }

    changeUserStatus(uuid, status) {
        const index = this.getPlayerIndex(uuid);
        const player = this.Players[index];
        player.setStatus = status;

        switch (status) {
            case 'ready':
                this.setReadyCount = this.readyCount + 1;
                break;
            case 'away':
                this.setReadyCount = Math.max(this.readyCount - 1, 0);
                break;
        }

    }

    checkIfPlayersAreReady() {
        return this.readyCount === this.Players.length;
    }

    getNextPlayerInLine() {
        const player = this.Players[this.getCurrentPlayer];
        return player.getUuid();
    }

    advancePlayerInLine() {
        this.setCurrentPlayer = this.getCurrentPlayer + 1;
    }

    checkCardType(card, uuid) {
        const color = card.charAt(0);
        const number = card.charAt(1);
        const player = this.getPlayerInfo(uuid);
        console.log(color, number);

        switch (this.getRound) {
            case 0: // JOINING PHASE
                break;
            case 1: // ROT ODER SCHWARZ
                if (color === 'c' || color === 's') {
                    return 'Schwarz';
                } else if (color === 'd' || color === 'h') {
                    return 'Rot';
                }
                break;
            case 2: // DRUNTER ODER DRÜBER
            {
                const cardNumber = player.cards[0].charAt(1);
                const firstCardNumber = this.getCardNumber(cardNumber);
                const lastCardNumber = this.getCardNumber(number);
                if (lastCardNumber < firstCardNumber) {
                    return 'Drunter';
                } else if (lastCardNumber > firstCardNumber) {
                    return 'Drüber';
                } else if (lastCardNumber === firstCardNumber) {
                    return 'Gleich';
                }
            }
                break;
            case 3: // INNEN ODER AUßEN
            {
                const firstCardNumber = this.getCardNumber(player.cards[0].charAt(1));
                const secondCardNumber = this.getCardNumber(player.cards[1].charAt(1));
                const lastCardNumber = this.getCardNumber(number);
                const max = Math.max(firstCardNumber,secondCardNumber,lastCardNumber);
                const min = Math.min(firstCardNumber,secondCardNumber,lastCardNumber);
                console.log(firstCardNumber,secondCardNumber,lastCardNumber);
                if (firstCardNumber === lastCardNumber || secondCardNumber === lastCardNumber) {
                    return 'Gleich';
                } else if (lastCardNumber !== max && lastCardNumber !== min) {
                    return 'Innerhalb';
                } else if (lastCardNumber === max || lastCardNumber === min) {
                    return 'Außerhalb';
                }
            }
                break;
            case 4: // hab ich, hab ich nicht
            {
                const firstCardColor = player.cards[0].charAt(0);
                const secondCardColor = player.cards[1].charAt(0);
                const thirdCardColor = player.cards[2].charAt(0);
                const lastCardColor = color.charAt(0);

                console.log(firstCardColor + ' ' + secondCardColor,thirdCardColor,lastCardColor);

                if (lastCardColor === firstCardColor || lastCardColor === secondCardColor || lastCardColor === thirdCardColor){
                    console.log('hab ich')
                    return 'Hab ich';
                } else {
                    return 'Hab ich nicht';
                }
            }
        }
    }

    getCardNumber(number) {
        switch (number) {
            case '2':
                return 2;
                break;
            case '3':
                return 3;
                break;
            case '4':
                return 4;
                break;
            case '5':
                return 5;
                break;
            case '6':
                return 6;
                break;
            case '7':
                return 7;
                break;
            case '8':
                return 8;
                break;
            case '9':
                return 9;
                break;
            case 'x':
                return 10;
                break;
            case 'b':
                return 11;
                break;
            case 'q':
                return 12;
                break;
            case 'k':
                return 13;
                break;
            case 'a':
                return 14;
                break;

        }
    }

}

module.exports = Game;
