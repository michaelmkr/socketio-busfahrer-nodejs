class Player {
    get getRound7RightCardCount() {
        return this._round7RightCardCount;
    }

    set setRound7RightCardCount(value) {
        this._round7RightCardCount = value;
    }
    set setStatus(value) {
        this.status = value;
    }
    get getKillable() {
        return this._killable;
    }

    set setKillable(boolean) {
        this._killable = boolean;
    }

    constructor(uuid, name) {
        this.uuid = uuid;
        this.name = name;
        this.cards = [];
        this.status = 'online';
        this._killable = false;
        this._round7RightCardCount = 0;
    }

    getUuid(){
        return this.uuid;
    }

    getName(){
        return this.name;
    }

    getCards(){
        return this.cards;
    }

    addCard(card){
        this.cards.push(card);
    }

    hasFinished(){
        console.log(this.name + 'has finished the game!');
        this.cards = [];
    }

}

module.exports = Player;
