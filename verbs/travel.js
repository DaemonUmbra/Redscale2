var loc = require('../location');

let act = async function(state, details) {
	switch (details.direction) {
		case 'north': 
			state.y = (state.y ? state.y : 0) - 1;
			break;
		case 'south': 
			state.y = (state.y ? state.y : 0) + 1;
			break;
		case 'west': 
			state.x = (state.x ? state.x : 0) - 1;
			break;
		case 'east': 
			state.x = (state.x ? state.x : 0) + 1;
			break;
		case 'up': 
			state.z = (state.z ? state.z : 0) + 1;
			break;
		case 'down': 
			state.z = (state.z ? state.z : 0) - 1;
			break;				
	}
	if (details.location !== undefined) state.location = details.location;
	if (details.x !== undefined) state.x = details.x;
	if (details.y !== undefined) state.y = details.y;
	if (details.z !== undefined) state.z = details.z;
	
	return loc.explore(state);
};


module.exports = {
	act: act
};