module.exports = {
    COMMANDS: {
        players: {
            command: 'getPlayers',
            aliases: ['list'],
            cooldown: 1,
            slug: 'players',
            requiredParams: []
        },
        broadcast: {
            command: 'broadcast',
            aliases: ['msg', 'say'],
            cooldown: 10,
            slug: 'broadcast',
            requiredParams: ['msg']
        },
        tp: {
            command: 'tpPlayer',
            cooldown: 60 * 30,
            slug: 'tp',
            key: params => params.player,
            requiredParams: ['player']
        },
        sound: {
            command: 'playSound',
            cooldown: 10,
            slug: 'sound',
            key: params => `${params.sound}-${params.target}`,
            requiredParams: ['sound']
        },
        weather: {
            command: 'setWeather',
            cooldown: 60 * 5,
            slug: 'weather',
            requiredParams: ['type', 'duration']
        },
        kick: {
            command: 'kickPlayer',
            cooldown: 60 * 5,
            slug: 'kick',
            key: params => params.player,
            requiredParams: ['player', 'reason']
        },
        whitelist: {
            command: 'addToWhitelist',
            cooldown: 60 * 30,
            slug: 'whitelist',
            requiredParams: ['player']
        },
        effect: {
            command: 'giveEffect',
            cooldown: 60 * 2,
            slug: 'effect',
            key: params => params.effect,
            requiredParams: ['effect']
        }
    }
}