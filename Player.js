class Player {
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

}

module.exports = Player;
