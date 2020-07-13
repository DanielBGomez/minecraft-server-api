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
            cooldown: 1200,
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
        kick: {
            command: 'kickPlayer',
            cooldown: 600,
            slug: 'kick',
            key: params => params.player,
            requiredParams: ['player', 'reason']
        },
        effect: {
            command: 'giveEffect',
            cooldown: 60,
            slug: 'effect',
            key: params => params.effect,
            requiredParams: ['effect']
        }
    }
}