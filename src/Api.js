/*
 * Funciones
 * ✅ Listar jugadores
 *   - Sacar stats jugador
 * ✅ Teletransporte
 *   ✅ Random
 *   ✅ Específico
 *   - Hacia otro player
 *   ✅ Protección (Safe mode)
 *      ✅ Cabina de protección
 * ✅ Reproducir sonidos
 * ✅ Kick
 * ✅ Tiempo y clima
 * ✅ Efectos (Nausea, Cegera, etc)
 * - Invocar mobs
 * - Give (dar items, etc)
*/

// const RCON = require('modern-rcon')
const RCON = require('rcon-client').Rcon
const Validate = require('./Validate')

class MinecraftRCONAPI {
    constructor(params = {}){
        // Vars
        this._rconConnection;
        this._connected = false

        this.SOUNDS = params.sounds || {}
        this.EFFECTS = params.effects || {}
        
        this._minecraftServer = params.minecraftServer || 'localhost'
        this._rconPort = (params.rcon || {}).port || 25575
        this._rconPassword = (params.rcon || {}).password || "password"

        // Callbacks
        this.onDisconnect = typeof params.onDisconnect == "function" ? params.onDisconnect : () => {}
        
        // Execs
    }
    send(command = 'say Hola Mundo'){
        try {
            this._verifyConnection()
        } catch(err) { 
            return Promise.reject(err)
        }

        return this._rconConnection.send(command)
    }
    connect(params = {}){
        return new Promise(async (resolve, reject) => {
            // Construct RCON Connection
            this._rconConnection = new RCON({
                    host: params.minecraftServer || this._minecraftServer, 
                    port: (params.rcon || {}).port || this._rconPort,
                    password: (params.rcon || {}).password ||  this._rconPassword
                })
            
            // Error handler
            this._rconConnection.on("error", err => reject({ msg: "No se ha podido conectar al servidor", err }))
            this._rconConnection.connect()
                .then(conn => {
                    this._rconConnection = conn
                    // Log
                    // console.log("Se ha conectado al servidor de minecraft!")

                    // Update connected status
                    this._connected = true

                    // Return Api instance
                    resolve(this)

                    /**
                     * Extension of Rcon lib
                     * handle close event
                     */
                    this._rconConnection.on('end', hadError => {
                            // Update connected status
                            this._connected = false

                            // Execute onDisconnect function
                            if(typeof this.onDisconnect == "function") this.onDisconnect(hadError)
                        })
                })
                .catch(e => {})
        })
    }
    /**
     * Broadcast message to chat.
     * 
     * @param {object} params 
     * @param {string} params.msg   Message
     * @param {string} params.name  Sender name
     */
    broadcast(params = {}){
        return new Promise((resolve, reject) => {
            const { msg } = params
            let { name } = params

            // Validate
            try {
                Validate.string(msg, { label: 'Message' })
            } catch(err) {
                return reject({ msg: "Los parámetros no son válidos", err: { msg: err } })
            }
            try {
                name = Validate.string(name, { label: 'Name', regexp: /^[A-Za-z ]{1,16}$/ })
            } catch(err) {
                name = false
            }

            // Send command
            this.send(`say ${name ? `[${name}] ` : ''}${msg}`)
                .then(resolve)
                .catch(reject)
        })
    }
    kickPlayer(params = {}){
        return new Promise((resolve, reject) => {
            const { player, reason = '' } = params

            // Validate
            const errors = {}

            try {
                Validate.string(player, { label: 'Player', regexp: /^(?:@[aeprs]|[A-Za-z1-9_]{1,16})$/ })
            } catch(err){ errors.player = err }

            try {
                Validate.string(reason, { label: 'Reason', length: { min: 0 } })
            } catch(err) { errors.reason = err }

            // Has errors
            if( Object.keys(errors).length ) return reject({ msg: "Los parámetros no son válidos", err: errors })

            // Send command
            this.send(`kick ${player} ${reason}`)   
                .then(resolve)
                .catch(reject)
        })
    }
    /**
     * Get array list of current players.
     */
    getPlayers(){
        return new Promise((resolve, reject) => {
            this.send("list")
                .catch(reject)
                .then(resp => {
                    // Parse resp
                    const players = ( `${resp}`.split(':')[1] || '').split(/\s|,/g).filter(e => e)

                    // Return players
                    resolve(players)
                })
        })
    }
    tpPlayer(params = {}){
        return new Promise((resolve, reject) => {
            // Player is required
            const { player, tier = 1 } = params
            
            const MaxNumber = 200 * Math.pow(10, 2 ) // tier)

            const x = typeof params.x != "undefined" ? params.x : parseInt( Math.random() * MaxNumber) - parseInt(MaxNumber / 2)
            const z = typeof params.z != "undefined" ? params.z : parseInt( Math.random() * MaxNumber) - parseInt(MaxNumber / 2)
            const y = typeof params.y != "undefined" ? params.y : parseInt( Math.random() * 240 ) + 10
            
            // Validate coords
            const errors = {}

            try {
                Validate.string(player, { regexp: /^(?:@[aeprs]|[A-Za-z1-9_]{1,16})$/ })
            } catch(err) {
                errors.player = err
            }
            try {
                Validate.number(x, { length: { min: -100000, max: 100000 } })
            } catch(err){
                errors.x = err
            }

            try {
                Validate.number(z, { length: { min: -100000, max: 100000 } })
            } catch(err){
                errors.z = err
            }

            try {
                Validate.number(y, { length: { min: 10, max: 255 } })
            } catch(err){
                errors.y = err
            }

            // Has errors?
            if( Object.keys(errors).length ) return reject({ msg: "Los valores no son válidos", err: errors })

            // Create glass cabin
            this.send(`tp ${player} ${x} ${y} ${z}`)
            .then(resp => {
                    // Wait 1 secs
                    setTimeout(() => {
                        // Send command
                        this.send(`execute at ${player} run fill ~-1 ~-1 ~-1 ~1 ~2 ~1 minecraft:glass hollow`)
                            .then(resp2 => resolve(`${resp} ${resp2}`))
                            .catch(reject)
                    }, 100) 
                })
                .catch(reject)
        })
    }
    /**
     * Remove status effects on players and other entities.
     * 
     * @param {object} params
     * @param {string|'@a'} params.player   Specifies the target(s).
     * @param {string|'all'} params.effect  Specifies the effect to clear.
     * @returns {Promise<object>}
     */
    clearEffect(params = {}){
        return new Promise((resolve, reject) => {
            const { player = '@a', effect } = params

            // Validations
            try {
                Validate.string(player, { label: 'Player', regexp: /^(?:@[aeprs]|[A-Za-z1-9_]{1,16})$/ })
            } catch(err) {
                errors.player = err
            }
            try {
                Validate.string(effect, { label: 'Effect', enum: this.EFFECTS || params.effects || [], optional: true })
            } catch(err) {
                errors.effect = err
            }

            // Has errors?
            if( Object.keys(errors).length ) return reject({ msg: "Los valores no son válidos", err: errors })

            // Send command
            this.send(`effect clear ${player} ${effect || ''}`)   
                .then(resolve)
                .catch(reject)
        })
    }
    /**
     * Add status effects on players and other entities.
     * 
     * @param {object} params
     * @param {string|'@a'} params.player           Specifies the target(s).
     * @param {string} params.effect                Specifies the effect to add.
     * @param {number|1} params.seconds             Specifies the effect's duration in seconds.
     * @param {number|1} params.amplifier           Specifies the number of additional levels to add to the effect.
     * @param {boolean|false} params.hideParticles  Specifies whether the particles and the HUD indicator‌ of the status effect should be hidden.
     * @returns {Promise<object>}
     */
    giveEffect(params = {}){
        return new Promise((resolve, reject) => {
            const { player = '@a', effect, seconds = 10, amplifier = 1, hideParticles = false } = params

            // Validations
            const errors = {}

            try {
                Validate.string(player, { label: 'Player', regexp: /^(?:@[aeprs]|[A-Za-z1-9_]{1,16})$/ })
            } catch(err) {
                errors.player = err
            }
            try {
                Validate.string(effect, { label: 'Effect', enum: this.EFFECTS || params.effects || [] })
            } catch(err) {
                errors.effect = err
            }
            try {
                Validate.number(seconds, { label: 'Seconds', length: { min: 0, max: 1000000 } })
            } catch(err) {
                errors.seconds = err
            }
            try {
                Validate.number(parseFloat(amplifier) - 1, { label: 'Amplifier', length: { min: 0, max: 255 } })
            } catch(err) {
                errors.amplifier = err
            }

            // Has errors
            if( Object.keys(errors).length ) return reject({ msg: "Los parámetros no son válidos", err: errors })

            // Send command
            this.send(`effect give ${player} ${effect} ${seconds} ${parseFloat(amplifier) - 1} ${hideParticles ? 'true' : 'false'}`)   
                .then(resolve)
                .catch(reject)
        })
    }
    /**
     * Plays a specified sound at a player, in a location, and in a specific volume and pitch.
     * 
     * @param {object} params 
     * @param {string} params.sound             Specifies the sound to play.
     * @param {string|'player'} params.source   Specifies the music category and options the sound falls under.
     * @param {string|'@a'} params.target       Specifies the sound's target.
     * @param {object} params.position          Specifies the position to play the sounds from.
     * @param {number|'~'} params.position.x    X coordinate
     * @param {number|'~'} params.position.y    Y coordinate
     * @param {number|'~'} params.position.z    Z coordinate
     * @param {number|1} params.volume          Specifies the distance that the sound can be heard.
     * @param {number|1} params.pitch           Specifies the pitch of the sound.
     * @returns {Promise<object>}
     */
    playSound(params = {}){
        return new Promise((resolve, reject) => {
            // Parse params
            const { sound, source = 'player', target = '@a', position = { x: '~', y: '~', z: '~' }, distance = 1, pitch = 1 } = params

            // Validations
            const errors = {}

            try {
                Validate.string(sound, { label: 'Sound', enum: this.SOUNDS || params.sounds || [] })
            } catch(err) { errors.sound = err }

            try {
                Validate.string(source), { label: 'Source', enum: ['ambient','block','hostile','master','music','neutral','player','record','voice','weather'] }
            } catch(err){ errors.source = err }

            try {
                Validate.string(target, { label: 'Target', regexp: /^(?:@[aeprs]|[A-Za-z1-9_]{1,16})$/ })
            } catch(err) { errors.target = err }

            try {
                switch(typeof position){
                    case 'object':
                        Validate.object(position, { label: 'Position', custom: coord => coord == '~' })
                        break
                    default:
                }
            } catch(err) { errors.position = err }

            // Has errors?
            if( Object.keys(errors).length ) return reject({ msg: "Los parámetros no son válidos", err: errors })

            // Playsound from console must be invoced from the execute command
            this.send(`execute at ${target} run playsound ${sound} ${source} ${target} ${position.x} ${position.y} ${position.z} ${distance} ${pitch}`)
                .then(resolve)
                .catch(reject)
        })
    }
    /**
     * Sets the weather.
     * 
     * @param {object} params 
     * @param {('clear'|'rain'|'thunder')} params.type  Specifies the weather type.
     * @param {number|300} params.duration                  Specifies the weather duration.
     * @returns {Promise<object>}
     */
    setWeather(params = {}){
        return new Promise((resolve, reject) => {
            const { type, duration = 300 } = params

            // Validations
            const errors = {}

            try {
                Validate.string(type, { label: 'Type', enum: ['clear', 'rain', 'thunder'] })
            } catch(err) {
                errors.type = err
            }
            try {
                Validate.number(duration, { label: "Duration", length: { min: 0, max: 1000000 } })
            } catch(err){
                errors.duration = err
            }

            // Has errors
            if( Object.keys(errors).length ) return reject({ msg: "Los parámetros no son válidos", err: errors })

            // Send command
            this.send(`weather ${type} ${duration}`)   
                .then(resolve)
                .catch(reject)
        })
    }
    /**
     * Changes the world's game time.
     * 
     * @param {object} params 
     * @param {'set'|'add'} params.type                                 Specifies the time type.
     * @param {number|'day'|'night'|'noon'|'midnight'} params.value     Specifies the time to add or set.
     * @returns {Promise<object>}
     */
    updateTime(params = {}){
        return new Promise((resolve, reject) => {
            const { type, value } = params

            // Validations
            const errors = {}

            try {
                Validate.string(type, { label: 'Type', enum: ['add', 'set'] })
            } catch(err) {
                errors.type = err
            }
            try {
                // If the type is 'set' the value can be a timespec or time value
                if(type == 'set') Validate.string(value, { label: 'Duration', regexp: /^(?:day|night|noon|midnight|\d{1,6})$/ })
                // Validate number
                else Validate.number(value, { label: 'Duration', length: { min: 0, max: 100000 } })
            } catch(err){
                errors.value = err
            }

            // Has errors
            if( Object.keys(errors).length ) return reject({ msg: "Los parámetros no son válidos", err: errors })

            // Send command
            this.send(`time ${type} ${value}`)   
                .then(resolve)
                .catch(reject)
        })
    }
    /**
     * Add player to the whitelist.
     * 
     * @param {object} params 
     * @param {string} params.player    Player's Minecraft username.
     * @returns {Promise<object>}
     */
    addToWhitelist(params = {}){
        return new Promise((resolve, reject) => {
            const player = params.player || params

            // Validations
            try {
                Validate.string(player, { label: 'Player', regexp: /^[A-Za-z1-9_]{1,16}$/ })
            } catch(err) {
                return reject({ msg: "Los parámetros no son válidos", err: { player: err } })
            }

            // Send command
            this.send(`whitelist add ${player}`)
                .then(resolve)
                .catch(reject)
        })
    }
    _verifyConnection(){
        if(!this._connected) throw { msg: "You must stablish a rcon connection before sending any data", err: {} }
    }
}

// Exports
module.exports = params => new MinecraftRCONAPI(params)
module.exports.Class = MinecraftRCONAPI

// Aditional Data
module.exports.AvailableCommands = []