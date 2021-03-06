const cache = require('./cache');
var gameengine = undefined;

let spotStyle = async function (state, zoneName, x, y, z) {
    let zone = await cache.load(`./data/locations/${zoneName}.json`);
    if (!(zone && zone.map && zone.map[z] && zone.map[z][y] && zone.map[z][y][x]))
        return null;
    if (state.world && state.world.locations) {
        zoneOverride = state.world.locations[zoneName];
        if (zoneOverride && zoneOverride[z] && zoneOverride[z][y] && zoneOverride[z][y][x] && zoneOverride[z][y][x].style)
            return zoneOverride[z][y][x].style;
    }
    return zone.map[z][y][x];
}

let getSpotDetails = async function(state, zoneName, x, y, z) {
    let spot = await spotStyle(state, zoneName, x, y, z);
    let zone = await cache.load(`./data/locations/${zoneName}.json`);
    let style = zone.styles[spot];
    if (!style) console.error("Style not found for " + spot + " in zone " + zoneName + "! getSpotDetails fail.");
    return { text: style.preview, light: style.light || "white", dark: style.dark || "black" };
}

let setupDirection = async function (state, zoneName, x, y, z, dir, control, hereStyle) {
    let overrided = hereStyle.directionOverrides && hereStyle.directionOverrides[dir];
    let over = (overrided ? hereStyle.directionOverrides[dir] : {}); // Direction override pretends 'here' is in the zone specified and offset by dimensions specified for purpose of calculating links in the given direction.
    if (over.disabled) return;
    let targetZone = zoneName;
    if (over.zone) targetZone = over.zone;
    let targetX = x + (over.x || 0);
    let targetY = y + (over.y || 0);
    let targetZ = z + (over.z || 0);
    let reqNS = null;
    let reqEW = null;
    switch (dir) {
        case "up": targetZ += 1; break;
        case "north": targetY -= 1; break;
        case "east": targetX += 1; break;
        case "west": targetX -= 1; break;
        case "south": targetY += 1; break;
        case "down": targetZ -= 1; break;

        case "nw": targetX -= 1; targetY -= 1; reqNS = "north"; reqEW = "west"; break;
        case "ne": targetX += 1; targetY -= 1; reqNS = "north"; reqEW = "east"; break;
        case "sw": targetX -= 1; targetY += 1; reqNS = "south"; reqEW = "west"; break;
        case "se": targetX += 1; targetY += 1; reqNS = "south"; reqEW = "east"; break;
    }

    if (overrided || ((!reqNS || control.sub[reqNS]) && (!reqEW || control.sub[reqEW]))) {
        if (await spotStyle(state, targetZone, targetX, targetY, targetZ)) {
            control.sub[dir] = await getSpotDetails(state, targetZone, targetX, targetY, targetZ);
            control.details[dir] = { location: (over.zone || zoneName), x: targetX, y: targetY, z: targetZ };
        }
    }
}

let getControls = async function (state) {
	let zone = await cache.load(`./data/locations/${state.location}.json`);
    let private = state.query.nsfw == 'true' && await cache.load(`./private/locations/${state.location}.json`);
    let controls = [[{ type: "navigator", details: {}, sub: {} }], []];
    if (!gameengine) gameengine = require('./gameengine'); // Lazy load to avoid circular dependency problem.

    let spot = await spotStyle(state, state.location, state.x, state.y, state.z);
	if (spot) {
		let style = zone.styles[spot];
        let pStyle = (private && private.styles && private.styles[spot]) ? private.styles[spot] : {};

        await Promise.all(["up", "north", "east", "west", "south", "down"].map((dir) => setupDirection(state, state.location, state.x, state.y, state.z, dir, controls[0][0], style)));
        await Promise.all(["nw", "ne", "sw", "se"].map((dir) => setupDirection(state, state.location, state.x, state.y, state.z, dir, controls[0][0], style)));
        controls[0][0].sub.here = { light: style.light || "white", dark: style.dark || "black" };

        let actions = pStyle.actions ? (style.actions || []).concat(pStyle.actions) : style.actions;
        if (actions) {
            for (var i = 0; i < actions.length; i++) {
                let action = (private && private.actions && private.actions[actions[i]]) || zone.actions[actions[i]];
                if (await gameengine.conditionMet(state, action.if)) {
                    let ctrl = await gameengine.getControl(state, action);
                    if (ctrl)
                        controls[1].push(ctrl);
                }
            }
		}
	} else {
		// If someone ends up stuck in a wall, so to speak, add a location reset button.
        controls[0][0].details.special = { location: "Dragonbone Cave", x: 4, y: 5, z: 0, help: "Debug warp to home." };
        controls[0][0].sub.special = { text: "You see your home through the mysterious portal of Ooops, how'd you get somewhere that isn't adjacent to anywhere?!", light: "white", dark: "black" };
	}
	return controls;
};

let explore = async function (state) {
    let zone = await cache.load(`./data/locations/${state.location}.json`);
    let private = state.query.nsfw == 'true' && await cache.load(`./private/locations/${state.location}.json`);
	//Temp:
    let spot = await spotStyle(state, state.location, state.x, state.y, state.z);
	if (spot) {
        if (!gameengine) gameengine = require('./gameengine'); // Lazy load to avoid circular dependency problem.

        let style = zone.styles[spot];
        let pStyle = (private && private.styles && private.styles[spot]) ? private.styles[spot] : {};

        // TODO: before checking random explore event, check for clock-based events.
        let events = pStyle.events ? style.events.concat(pStyle.events) : style.events;
        let randomEvent = await gameengine.randomChoice(state, events);

        if (randomEvent && randomEvent.event) {
            console.log(`triggered event: ${randomEvent.event}\nPrivate: ${private && private.events && private.events[randomEvent.event] ? JSON.stringify(private.events[randomEvent.event]) : undefined}\nNormal: ${JSON.stringify(zone.events[randomEvent.event])}`);
            let event = (private && private.events && private.events[randomEvent.event]) || zone.events[randomEvent.event];
            console.log(`Triggered random event: ${event.verb}: ${JSON.stringify(event.details)}`);
            await gameengine.doVerb(event.verb, state, event.details);
        }
        // Use shift to force style description in front, even though we let event happen first (it may chenge our style)
        state.view.display.unshift({
            type: "text",
            text: style.description + "\n\n",
            pause: 100
            });
	} else {
        gameengine.displayText(state, "Ooops, you somehow ended up outside reality.");
	}
};

let getDescription = async function (state) {
    let zone = await cache.load(`./data/locations/${state.location}.json`);
    let spot = await spotStyle(state, state.location, state.x, state.y, state.z);
    if (spot) {
        if (!gameengine) gameengine = require('./gameengine'); // Lazy load to avoid circular dependency problem.

        let style = zone.styles[spot];
        return style.description;
    }
    return "Ooops, you somehow ended up outside reality.";
};

let getTitle = async function (state) {
    let zone = await cache.load(`./data/locations/${state.location}.json`);
    let spot = await spotStyle(state, state.location, state.x, state.y, state.z);
    if (spot) {
        if (!gameengine) gameengine = require('./gameengine'); // Lazy load to avoid circular dependency problem.

        let style = zone.styles[spot];
        return style.title;
    }
    return "Outside Space and Time";
};

let checkRequirements = async function (state, details) {
    let zone = await cache.load(`./data/locations/${details.location}.json`);
    let spot = await spotStyle(state, details.location, details.x, details.y, details.z);
    if (spot) {
        let style = zone.styles[spot];
        let party = state.parties[state.activeParty];
        if (style.requireall) {
            for (var req in style.requireall) {
                if (!!party.leader.tags[req] != style.requireall[req]) {
                    gameengine.displayText(state, `You can't go that way, because you ${style.requireall[req] ? "aren't" : "are"} a ${req}.\n`);
                }
                for (var i = 0; i < party.followers.length; i++) {
                    if (!!party.followers[i].tags[req] != style.requireall[req]) {
                        gameengine.displayText(state, `You can't go that way, because ${party.followers[i].display} ${style.requireall[req] ? "isn't" : "is"} a ${req}.\n`);
                    }
                }
                for (var i = 0; i < party.pawns.length; i++) {
                    if (!!party.pawns[i].tags[req] != style.requireall[req]) {
                        gameengine.displayText(state, `You can't go that way, because ${party.pawns[i].display} ${style.requireall[req] ? "isn't" : "is"} a ${req}.\n`);
                    }
                }
            }
        }
        if (style.requireone) {
            for (var req in style.requireall) {
                let gotOne = false;
                if (!!party.leader.tags[req] == style.requireall[req]) {
                    gotOne = true;
                    continue;
                }
                for (var i = 0; i < party.followers.length; i++) {
                    if (!!party.followers[i].tags[req] == style.requireall[req]) {
                        gotOne = true;
                        break;
                    }
                }
                if (gotOne) continue;
                for (var i = 0; i < party.pawns.length; i++) {
                    if (!!party.pawns[i].tags[req] == style.requireall[req]) {
                        gotOne = true;
                        break;
                    }
                }
                if (!gotOne) {
                    gameengine.displayText(state, `You can't go that way, because no one in your party ${style.requireall[req] ? "is" : "is not"} a ${req}.\n`);
                }
            }
        }
        return !(state.view.status);
    } else {
        gameengine.displayText(state, "There isn't anywhere to go in that direction.");
        return false;
    }
};

let getBuildOptions = async function (state) {
    if (!gameengine) gameengine = require('./gameengine'); // Lazy load to avoid circular dependency problem.

    let spot = await spotStyle(state, state.location, state.x, state.y, state.z);
    state.buildoptions = {};
    let any = false;
    if (spot) {
        let zone = await cache.load(`./data/locations/${state.location}.json`);
        let style = zone.styles[spot];
        if (style.buildoptions) {
            for (var option in style.buildoptions) {
                if (style.buildoptions[option] === true) {
                    state.buildoptions[option] = true;
                    any = true;
                }
                else {
                    let condition = await gameengine.conditionMet(state, style.buildoptions[option]);
                    if (condition) {
                        state.buildoptions[option] = true;
                        any = true;
                    }
                }
            }
        }
    }
    if (!any) state.buildoptions = null;
}

module.exports = {
    checkRequirements: checkRequirements,
	explore: explore,
    getControls: getControls,
    getDescription: getDescription,
    getTitle: getTitle,
    getBuildOptions: getBuildOptions
};