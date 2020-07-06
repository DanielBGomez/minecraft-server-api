module.exports = {
    COMMANDS: {
        players: {
            command: 'getPlayers',
            aliases: ['list'],
            cooldown: 1,
            slug: 'players',
            requiredParams: []
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
            key: params => `${params.sound}-${params.target}`,
            requiredParams: ['sound']
        },
        kick: {
            command: 'kickPlayer',
            cooldown: 600,
            key: params => params.player,
            requiredParams: ['player', 'reason']
        }
    }
}