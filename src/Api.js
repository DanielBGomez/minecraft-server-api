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
 * - Tiempo y clima
 * - Efectos (Nausea, Cegera, etc)
 * - Invocar mobs
 * - Give (dar items, etc)
*/

const RCON = require('modern-rcon')
const Validate = require('./Validate')

class MinecraftRCONAPI {
    constructor(params = {}){
        // Vars
        this._rconConnection;
        this._connected = false
        this._sounds = params.sounds || {}
        
        this._minecraftServer = params.minecraftServer || 'localhost'
        this._rconPort = (params.rcon || {}).port || 25575
        this._rconPassword = (params.rcon || {}).password || "password"
        
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
        return new Promise((resolve, reject) => {
            // Construct RCON Connection
            this._rconConnection = new RCON(
                    params.minecraftServer || this._minecraftServer, 
                    (params.rcon || {}).port || this._rconPort,
                    (params.rcon || {}).password ||  this._rconPassword
                )
    
            // Probar conexión
            this._rconConnection.connect()
                .then(() => {
                    // Log
                    console.log("Se ha conectado al servidor de minecraft!")

                    // Update connected status
                    this._connected = true

                    // Return Api instance
                    resolve(this)
                })
                .catch(err => reject({ msg: "No se ha podido conectar al servidor", err }))
        })
    }
    kickPlayer(params = {}){
        return new Promise((resolve, reject) => {
            const { player, reason = '' } = params

            // Validate
            const errors = {}

            try {
                Validate.string(player, { label: 'Player', regex: /^(?:@[aeprs]|[A-Za-z_]{1,16})$/ })
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
            const player = params.player
            
            const x = typeof params.x != "undefined" ? params.x : parseInt( Math.random() * 200000) - 100000
            const z = typeof params.z != "undefined" ? params.z : parseInt( Math.random() * 200000) - 100000
            const y = typeof params.y != "undefined" ? params.y : parseInt( Math.random() * 240 ) + 10
            
            // Validate coords
            const errors = {}

            try {
                Validate.string(player, { regex: /^(?:@[aeprs]|[A-Za-z_]{1,16})$/ })
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
                // Send command
                    this.send(`fill ${x - 1} ${y - 1} ${z - 1} ${x + 1} ${y + 2} ${z + 1} minecraft:glass hollow`)
                        .then(resp2 => resolve(`${resp} ${resp2}`))
                        .catch(reject)
                })
                .catch(reject)
        })
    }
    /**
     * 
     * @bug "Sound is to far away to be heard"
     * 
     * @param {object} params 
     */
    playSound(params = {}){
        return new Promise((resolve, reject) => {
            // Parse params
            const { sound, source = 'player', target = '@a', position = { x: '~', y: '~', z: '~' }, distance = 1, pitch = 1 } = params

            /**
             *  /playsound <sound> <source> <targets> [x] [y] [z] [volume] [pitch] [minimumVolume]
             *
             * sound is the sound effect to start playing. (See List of Sound Effect Names.)
             * source is the source that you want to play the sound effect. It can be one of the following: ambient, block, hostile, master, music, neutral, player, record, voice, weather.
             * targets is the name of the player (or a target selector) that you wish to play the sound effect for.
             * x y z is optional. It is the coordinate where the sound will be played from. Learn about the coordinate system.
             * volume is optional. The sound can be heard within an audible sphere. The volume determines the size of that audible sphere and therefore the distance away that the sound can be heard. The volume must be at least a value of 0.0. The higher the value, the larger the audible sphere and the further away the sound effect can be heard.
             * pitch is optional. It determines the pitch for the sound effect. It can be a value between 0.0 and 2.0. The higher the value, the higher the pitch.
             * minimumVolume is optional. It is determines the minimum volume that the sound will be heard outside of the audible sphere. It can be a value between 0.0 and 1.0.  
            */

            /**
             * Sound
             * - <Need list>
             */

            /**
             * Target source (?)
             * - ambient
             * - block
             * - hostile
             * - master
             * - music
             * - neutral
             * - player
             * - record
             * - voice
             * - weather
             */

            // Validations
            const errors = {}

            try {
                Validate.string(sound, { label: 'Sound', enum: this._sounds })
            } catch(err) { errors.sound = err }

            try {
                Validate.string(source), { label: 'Source', enum: ['ambient','block','hostile','master','music','neutral','player','record','voice','weather'] }
            } catch(err){ errors.source = err }

            try {
                Validate.string(target, { label: 'Target', regex: /^(?:@[aeprs]|[A-Za-z_]{1,16})$/ })
            } catch(err) { errors.target = err }

            try {
                switch(typeof position){
                    case 'object':
                        Validate.object(position, { label: 'Position', custom: coord => coord == '~' })
                        break
                    default:
                }
            } catch(err) { errors.position = err }

            //
            if( Object.keys(errors).length ) return reject({ msg: "Los parámetros no son válidos", err: errors })

            // Playsound from console must be invoced from the execute command
            this.send(`execute at ${target} run playsound ${sound} ${source} ${target} ${position.x} ${position.y} ${position.z} ${distance} ${pitch}`)
                .then(resolve)
                .catch(reject)
        })
    }
    _verifyConnection(){
        if(!this._connected) throw { msg: "You must stablish a rcon connection before sending any data", err: {} }
    }
}

module.exports = params => new MinecraftRCONAPI(params)
module.exports.Class = MinecraftRCONAPI

// Aditional Data
module.exports.AvailableCommands = []