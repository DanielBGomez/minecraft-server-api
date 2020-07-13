// Modules
require('dotenv').config()
const fs = require('fs-extra')
const path = require('path')
const https = require("https")
const express = require('express')
const cors = require('cors')
const slowDown = require('express-slow-down')
const helmet = require('helmet')
const io = require('socket.io')

// Local Modules
const Api = require('./Api')
const Cache = require('./Cache')
const Validate = require('./Validate')

// Configs
const API_CONFIG = require('../configs/api')
// const IS_DEVELOPMENT = process.env.NODE_ENV == 'development'

// Class
class Server {
    constructor(params = {}){

        /**
         * Vars
         */
        this._Api;
        this._App;
        this._Server;
        this._SocketServer;
        this._loop;

        this.players = new Set()

        this.API_OPTIONS = params.api || {}
        this.CACHE_OPTIONS = params.cache || {}

        this.CORS_OPTIONS = params.corsOptions || {}
        this.DIST_PATH = params.distPath || 'dist'

        this.SSL_CERT = (params.ssl || {}).cert
        this.SSL_KEY = (params.ssl || {}).key

        this.PORT = params.port || 3100

        this.LOOP_INTEVAL = params.loopInterval || 1000

        /**
         * Execs
         */

        // Listeners

    }
    /**
     * Initialize server instance.
     * 
     * @param {object} params   Configuration params
     */
    async init(params = {}){
        // Create app
        this._App = express()

        // Init API
        this._Api = Api(params.api || this.API_OPTIONS)

        // Init Cache connection
        try {
            this._Cache = Cache(params.cache || this.CACHE_OPTIONS)
        } catch(err){
            console.log("Can't connect to cache server", err)
            process.exit()
        }

        // Setup middlewares
        // Cors
        this._App.use(cors(params.corsOptions || this.CORS_OPTIONS))
        // Setup dist path
        this._App.use(express.static(path.join(__dirname, params.distPath || this.DIST_PATH), { index: false }))
        this._App.use(helmet())
        this._App.use(slowDown({
            windowMs: 15 * 1000, // 15 secs
            delayAfter: 5, // 5 request per 15 secs
            delayMs: 1000, // Delay 1sec per request above 5
        }))

        this._App.use(express.json())

        // Setup queue
        this._App.post('/queue', this.queue.bind(this))

        // this._App.get('/', (req, res) => {
        //     res.sendFile( path.join( __dirname, params.distPath || this.DIST_PATH, 'taskpane.html') )
        // })

        // Start server
        this._Server = https.createServer({ 
                cert: (params.ssl || {}).cert || this.SSL_CERT,
                key: (params.ssl || {}).key || this.SSL_KEY
            }, this._App)
            
        // Bind socket server
        this._SocketServer = io(this._Server, params.socketOptions)

        // Start
        this._Server.listen(params.port || this.PORT)
        this.log("Server listening on port " + this.PORT)
        
        // Listeners

        // Executions
        this._loop = this.connectLoop()

        // Return instance
        return this
    }
    /**
     * Loop that tries to connect to minecraft server
     */
    connectLoop(lastWait = 1000){
        this.log("Trying to connect to Minecraft Server...")

        this._Api.connect()
            .then(() => {
                this.log("Connected to Minecraft Server!")

                // Start parsing loop
                this._loop = this.loop()

                // Disconnect event
                this._Api.onDisconnect = e => {
                        this.log("Connection with Minecraft server lost!")

                        // Clear loop
                        clearTimeout(this._loop)

                        // Setup connect loop
                        this._loop = this.connectLoop()
                    }
            })
            .catch(err => {
                this.log("Can't connect to Minecraft server", err)

                // Parse lastWait
                lastWait = parseInt(lastWait)
                if(lastWait < 1000) lastWait = 1000

                let wait = lastWait * 2
                if(wait > 60000) wait = 60000

                this.log(`Next attemp in ${lastWait / 1000} seconds`)

                setTimeout(() => this._loop = this.connectLoop(wait), wait)
            })
    }
    /**
     * Loop that looks up for queued commands and executes them.
     */
    loop(){
        // Get queued commands
        this._Cache.get('commands', 'queue')
            .then(commands => {
                const QueuedCommands = Object.keys(commands || {})

                // Log
                if(QueuedCommands.length) this.log(`${QueuedCommands.length} commands queued!`)

                // Parse queued commands
                Promise.allSettled( QueuedCommands.map(key => new Promise((resolve, reject) => {
                            // Split key
                            key = key.split(':')

                            // Get command data
                            this._Cache.get(key[0], key[1])
                                .then(params => {
                                    // Command, ttl
                                    const { command, ttl } = params

                                    // Execute
                                    this._Api[command](params)
                                        .then(resp => {
                                            // Execute function (?)
                                            this.log(resp)
                                        })
                                        .catch(err => {
                                            // Store in some "not executed" log
                                            this.log("Unable to execute command", { params, err })
                                        })
                                        .finally(() => {
                                            // Set cooldown on command
                                            this._Cache.client.EXPIRE(`${key[0]}:${key[1]}`, ttl, (err, resp) => {
                                                    if(err) this.log("Expire err", err)
                                                })
                                            // Remove from queue
                                            this._Cache.client.HDEL('commands:queue', `${key[0]}:${key[1]}`, (err, resp) => {
                                                if(err) this.log('De-queue err', err)

                                                // Resolve
                                                resolve()
                                            })
                                        })
                                })
                                .catch(reject)
                        })
                    ))
                    .then(resp => {
                        if(resp.length) this.log("Queued commands parsed", resp)
                    })
                    .finally(() => setTimeout(() => this._loop = this.loop(), this.LOOP_INTEVAL))
            })
            .catch(err => {
                // Log error
                this.log("Queue lookup error", err)

                // Restart loop
                setTimeout(() => this._loop = this.loop(), this.LOOP_INTEVAL)
            })
    }
    /**
     * Queue command as middleware
     * 
     * @param {object} req  Express request object
     * @param {object} res  Express response object
     */
    queue(req, res){
        new Promise( async (resolve, reject) => {
                // Validate command (exist)
                const PARAMS = req.body // req.body -- for posts
                const COMMAND_DATA = API_CONFIG.COMMANDS[PARAMS.command] || Object.keys(API_CONFIG.COMMANDS).map(key => API_CONFIG.COMMANDS[key]).find(data => (data.aliases || []).includes(PARAMS.command) )
                
                // Validate command
                if(!COMMAND_DATA) return reject({ code: 409, msg: 'El comando solicitado no se encuentra disponible', data: { command: PARAMS.command }, errKey: 'COMMAND_NOT_FOUND' })

                delete PARAMS.command
                
                // Validate params
                if(Array.isArray(COMMAND_DATA.requiredParams)) {
                    if(COMMAND_DATA.requiredParams.some(param => typeof PARAMS[param] == 'undefined')) return reject({ code: 400, msg: 'Alguno de los parámetros requeridos no se encuentran en la solicitud', data: { required: COMMAND_DATA.requiredParams }, errKey: 'MISSING_PARAMS'})
                }
        
                // Get command key
                const KEY = typeof COMMAND_DATA.key == 'function' ? COMMAND_DATA.key(PARAMS) : COMMAND_DATA.key || 'default'
        
                // Validate cooldown (cache)
                let cachedData = {}
                try {
                    cachedData = await this._Cache.get(COMMAND_DATA.slug, KEY)
                } catch(err) {
                    this.log("Cache error", err)
                    return reject({ code: 500, msg: 'Algo salió mal con el sistema de caché', errKey: 'CACHE_ERROR', err })
                }
        
                if(cachedData) {
                    // Duplicated? (not fired)
                    // console.log(cachedData)
                    try {
                        // Is in queue? -- HGET is not defined in the Cache module; that's why here's an Awaited Promise
                        const QueueData = await new Promise((resolve, reject) => {
                                this._Cache.client.HGET('commands:queue', `${COMMAND_DATA.slug}:${KEY}`, (err, data) => {
                                        if(err) return reject(err)
                                        resolve(data)
                                    })
                            })
        
                        if(QueueData) return res.status(201)
                    } catch(err) {
                        this.log("Cache error", err)
                        return reject({ code: 500, msg: 'Algo salió mal con el sistema de caché', errKey: 'CACHE_ERROR', err })
                    }
                    // return res.status(201).send("Comando registrado!")

                    // Get cooldown -- TTL is not defined in the Cache module; that's why here's an Awaited Promise
                    let cooldown;
                    
                    try {
                        cooldown = await new Promise((resolve, reject) => {
                                this._Cache.client.TTL(`${COMMAND_DATA.slug}:${KEY}`, (err, data) => {
                                        if(err) return reject(err)
                                        resolve(data)
                                    })
                            })
                    } catch {} // Ignore cooldown errs
        
                    // Return 'on Cooldown'
                    return reject({ code: 429, msg: 'El comando se encuentra en enfriamiento', err: { cooldown }, errKey: 'COMMAND_ON_COOLDOWN' })
                }
        
                // Register command
                this._Cache.save(COMMAND_DATA.slug, { ...PARAMS, ...{ ttl: COMMAND_DATA.cooldown, command: COMMAND_DATA.command } }, { mkey: KEY, ttl: false, indexes: [] })
                    .then(resp => {
                        // Create queue data
                        const CommandsData = {}
                        CommandsData[`${COMMAND_DATA.slug}:${KEY}`] = new Date()
        
                        // Store queue data
                        this._Cache.save('commands', CommandsData, { mkey: 'queue', ttl: false, indexes: [] })
                            .then(data => resolve({ code: 201, msg: "El comando se ha puesto en la cola exitosamente!", data: { cooldown: COMMAND_DATA.cooldown, data } }))
                            .catch(err => reject({ code: 500, msg: 'Algo salió mal con el sistema de caché', errKey: 'CACHE_ERROR', err }))
                    })
                    .catch(err => reject({ code: 500, msg: 'Algo salió mal con el sistema de caché', errKey: 'CACHE_ERROR', err }))
            })
            .then(data => {
                this.log("Command queued", data)
                res.status(201).send(data)
            })
            .catch(err => {
                // Log
                this.log("Queue error", err)
                // Send
                res.status(err.code || 500).send(err)
            })
    }
    /**
     * Log any server event
     * 
     * @param {*} msg 
     * @param  {...any} data 
     */
    log(msg, ...data) {
        // Log time
        const time = new Date()
        // Output msg in console
        console.log(`[${time.toISOString()}]`, msg)
        // If data is defined, output in console
        if(data.length) console.log(`[${time.toISOString()}]`, ...data)
    }
}

module.exports = params => new Server(params)
module.exports.Class = Server