// Future note: GameEngine reference will be needed eventually. it needs to lazy load like location.js does, because of circular dependency.
let cache = require('./cache');

let addControls = function (state, controls) {
	// TODO
}

let getStatusDisplay = function (state) {
    let leader = state.parties[state.activeParty].leader;
    let healthText = `Health: ${leader.health} / ${leader.maxHealth}`;
    let staminaText = `Stamina: ${leader.stamina} / ${leader.maxStamina}`;
    let nutritionText = `Nutrition: ${leader.nutrition} / ${leader.maxNutrition}`;
    let manaText = `Mana: ${leader.mana} / ${leader.maxMana}`;
	let statusDisplay = {
        lines: [{ "text": healthText, "help":"Health.\nWhen your health drops to zero, you will be force to rewind to your last rest point. Over time, nutrition converts to stamina and then to health." },
            { "text": staminaText, "help":"Stamina.\nWhen your stamina drops to zero, you will need to digest food to recover. Some actions spend stamina, and also it converts to health over time."},
            { "text": nutritionText, "help": "Nutrition.\nEat food to fill up so you can recover and heal." },
            { "text": manaText, "help": "Mana.\nThe mystical energy that wells up within you over time." }
        ]
	};
	
	return statusDisplay;
}

let setDefaults = function (state) {
    // Backfill default values not already in the save. Difference between this and migrations is migrations are to change existing data that has been transformed or rebalanced.

    if (!state.parties) {
        state.parties = [
            {
                "display": "Main party",
                "leader": {
                    "name": "Redscale",
                    "display": "Redscale",
                    "health": 100,
                    "maxHealth": 100,
                    "stamina": 100,
                    "maxStamina": 100,
                    "nutrition": 100,
                    "maxNutrition": 100,
                    "mana": 100,
                    "maxMana": 100,
                    "healthRecover": 5,
                    "staminaRecover": 10,
                    "manaRecover": 1,
                    "evasion": 10,
                    "aggressCards": { "Instinctive Bite": 5, "Instinctive Claws": 5, "Instinctive Tail Slap": 5 },
                    "abjureCards": { "Instinctive Dodge": 5, "Instinctive Deflect": 5, "Instinctive Brace": 5 },
                    "assessCards": [{ "card": "Press the attack" }, { "card": "Fight defensively" }],
                    "aggressDefaultHand": { "Instinctive Bite": 1 , "Instinctive Claws": 1, "Instinctive Tail Slap": 1 },
                    "abjureDefaultHand": { "Instinctive Dodge": 1, "Instinctive Deflect": 1, "Instinctive Brace": 1 }
                },
                "followers": [],
                "pawns": [],
                "inventory": []
            }];
    }
    state.activeParty = state.activeParty || 0;
}

let passiveRecoverAll = function (state) {
    state.parties.forEach((party) => {
        passiveRecover(party.leader);
        // TODO recover the rest of the party
    });
};

let passiveRecover = function (character) {
    let deltaHealth = Math.min(character.maxHealth - character.health, character.stamina + Math.min(character.staminaRecover, character.nutrition), character.healthRecover);
    character.health += deltaHealth;
    character.stamina -= deltaHealth;

    let deltaStamina = Math.min(character.maxStamina - character.stamina, character.nutrition, character.staminaRecover);
    character.stamina += deltaStamina;
    character.nutrition -= deltaStamina;

    character.mana = Math.min(character.maxMana, character.mana + character.manaRecover);
};


let reloadArchive = async function (state) {
    let oldPath = state.archive ? `saves/archive/${state.archive}.json` : './data/newGame.json';
    let oldState = await cache.load(oldPath);
    if (!oldState && state.archive)
        oldState = await cache.load('./data/newGame.json');
    setDefaults(oldState);
    // TODO: run any pending migrations.

    let archive = state.archive;

    for (var prop in state) { if (state.hasOwnProperty(prop)) { delete state[prop]; } }
    Object.assign(state, oldState);
    state.archive = archive; // preserve linking. TODO: support jumping back multiple steps.
}

module.exports = {
	addControls: addControls,
    getStatusDisplay: getStatusDisplay,
    setDefaults: setDefaults,
    reloadArchive: reloadArchive,
    passiveRecoverAll: passiveRecoverAll
};