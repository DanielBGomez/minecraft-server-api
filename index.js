// Modules
require('dotenv').config()
const fs = require('fs-extra')

// Local Modules
const Server = require('./src/Server')

// Configs
const Sounds = require('./configs/sounds.json')

// Init server
const instance = Server({
    distPath: process.env.DIST_PATH,
    port: process.env.PORT,
    loopInterval: 5000,
    ssl: {
        cert: fs.readFileSync(process.env.SSL_CERT || 'ssl/server.crt'),
        key: fs.readFileSync(process.env.SSL_KEY || 'ssl/server.key')
    },
    api: {
        minecraftServer: process.env.MCSV_IP,
        sounds: Sounds,
        rcon: {
            port: process.env.MCSV_RCON_PORT,
            password: process.env.MCSV_RCON_PASSWORD
        }
    }
}).init()