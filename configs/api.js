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
            cooldown: 60 * 25,
            slug: 'tp',
            key: params => params.player,
            requiredParams: ['player']
        },
        sound: {
            command: 'playSound',
            cooldown: 5,
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
        time: {
            command: 'updateTime',
            cooldown: 60 * 5,
            slug: 'time',
            requiredParams: ['type', 'value']
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
            cooldown: 60 * 3.5,
            slug: 'effect',
            key: params => `${params.effect}-${params.player}`,
            requiredParams: ['effect']
        }
    }
}