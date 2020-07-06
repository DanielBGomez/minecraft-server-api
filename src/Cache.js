// Modules
require('dotenv').config()
const redis = require('redis')

// API Modules
const Validate = require('./Validate')

// Configs
const isDevelopment = process.env.NODE_ENV == 'development'

// Class
class Cache {
    constructor(params = {}){
        // Create redis client
        this.client = redis.createClient(params.port || process.env.REDIS_PORT, params.host || process.env.REDIS_HOST, {
            no_ready_check: true
        })

        this.defaultTTL = process.env.REDIS_TTL || 3600 // Seconds; 1 hour
    }
    get(group, identifier){
        if(!group) return Promise.reject({ fault: "client", msg: "No valid group provided", data: { group } })
        if(!identifier) Promise.reject({ fault: "client", msg: "No identifier provided", data: { identifier } })

        return new Promise(async (resolve, reject) => {
            try {
                // Get values as hash if is an uuid
                Validate.uuid(identifier)

                return this.client.HGETALL(`${group}:${identifier}`, (err, resp) => {
                        if(err) {
                            if(isDevelopment) console.log("Redis err", err)
                            return reject({ fault: "server", msg: "Redis error", data: { err } })
                        }

                        if(resp == null) resolve()
                        resolve(resp)
                    })
            } catch {} // Ignore -- Not an uuid

            try {
                // Get uuid if identifier is an id
                Validate.number(identifier, { length: { min: 0 } })

                // Get uuid from index
                return this.client.ZRANGEBYSCORE(`${group}.id.index`, identifier, identifier, (err, resp) => {
                        if(err) {
                            if(isDevelopment) console.log("Redis err", err)
                            return reject({ fault: "server", msg: "Redis error", data: { err } })
                        }

                        if(!resp.length) return resolve()

                        // Parse index
                        const uuid = resp[0].split(":")[1]

                        return this.get(group, uuid)
                            .then(resolve)
                            .catch(reject)
                    })
            } catch {}

            // Maybe a custom identifier?
            this.client.HGETALL(`${group}:${identifier}`, (err, resp) => {
                if(err) {
                    if(isDevelopment) console.log("Redis err", err)
                    return reject({ fault: "server", msg: "Redis error", data: { err } })
                }


                // At last, is using another unique?
                if(resp == null) return this.client.GET(`${group}-uniques:${identifier}`, (err, resp) => {
                        if(err) {
                            if(isDevelopment) console.log("Redis err", err)
                            return reject({ fault: "server", msg: "Redis error", data: { err } })
                        }

                        // Try again
                        this.client.HGETALL(`${group}:${resp}`, (err, resp) => {
                                if(err) {
                                    if(isDevelopment) console.log("Redis err", err)
                                    return reject({ fault: "server", msg: "Redis error", data: { err } })
                                }

                                // Resolve empty :c
                                if(resp == null) return resolve()

                                // Found!
                                return resolve(resp)
                            })
                    })

                // Found!
                resolve(resp)
            })
        })
    }
    save(group, data = {}, options = {}){
        if(!group) return Promise.reject("No valid group provided")

        return new Promise( (resolve, reject) => {
            try {
                const keys = Object.keys(data)
                const mkey = options.mkey || data[options.identifier] || data.uuid

                
                if(isDevelopment) console.log(`[Cache] Saving '${group}:${mkey}' with ${keys.length} keys...`)

                console.log(data)

                // Parse data
                const HSET_DATA = keys.map(key => {
                        // Ignore null values
                        if(data[key] == null) return;

                        // Parse values
                        return `${key}|#-#|${
                            typeof data[key] == "object" ?
                                // Array object
                                Array.isArray(data[key]) ? 
                                    data[key].join(",")
                                    
                                // Date object
                                : typeof data[key].getMonth == "function" ?
                                    `${data[key]}`
                                
                                // Default object
                                :
                                    JSON.stringify(data[key])
                            : data[key]
                        }`
                    })
                    .filter(e => typeof e != "undefined")
                    .join("|#-#|")
                    .split("|#-#|")

                this.client.HSET(`${group}:${mkey}`, HSET_DATA, (err, resp) => {
                        console.log('[Cache] HSET Ended ', resp)
                            
                        if(err) {
                            if(isDevelopment) console.log("Redis err", err)
                            reject({ fault: "server", msg: "Redis error", data: { err } })
                        }
                        
                        /*
                        * Aditional functions
                        */

                        // Set expiration
                        const ttl = options.ttl || this.defaultTTL
                        if(ttl) {
                            try {
                                this.client.EXPIRE(`${group}:${mkey}`, ttl, (err, resp) => 0) // Ignore response
                            } catch {} // Ignore errors
                        }

                        const PROMISES = []

                        // Save aliases
                        if(Array.isArray(options.uniques)){
                            // Create data obj
                            PROMISES.push(
                                this.createRefs(group, mkey, options.uniques.map(key => data[key]))
                            )
                        }
                        // Add indexes
                        const INDEXES = options.indexes || ["id"]
                        if(Array.isArray(INDEXES) && INDEXES.length){
                            // Create indexes
                            PROMISES.push(
                                Promise.all( options.indexes || ["id"].map(index => {
                                    if(data[index]) return this.createIndex(group, mkey, index, data[index])
                                }) )
                            )
                        }

                        // Parse promises
                        Promise.all(PROMISES)
                            .then(resolve)
                            .catch(reject)
                    })

            } catch(err){
                reject({ fault: "client", msg: "Invalid data provided", data: { err } })
            }
        })
    }
    createRefs(group, identifier, uniqueRefs = []){
        if(!group) return Promise.reject("No valid group provided")
        if(!identifier) return Promise.reject("No valid identifier provided")
        if(!Array.isArray(uniqueRefs)) return Promise.reject("No valid unique references provided")

        // Save uniques references
        return Promise.all(uniqueRefs.map(unique => this.client.SET(`${group}-uniques:${unique}`, identifier)))
    }
    createIndex(group, mkey, indexKey, indexValue){
        return new Promise((resolve, reject) => {
            this.client.ZADD(`${group}.${indexKey}.index`, indexValue, `mkey:${mkey}`, (err, resp) => {
                    if(err) {
                        if(isDevelopment) console.log("Redis err", err)
                        reject({ fault: "server", msg: "Redis error", data: { err } })
                    }
                    resolve(resp)
                })
        })
    }
    flush(group, identifier){
        if(!group) return Promise.reject("No valid group provided")

        return new Promise((resolve, reject) => {
            try {
                // Delete key
                this.client.DEL(`${group}:${identifier}`, (err, resp) => {
                        if(err) {
                            if(isDevelopment) console.log("Redis err", err)
                            reject({ fault: "server", msg: "Redis error", data: { err } })
                        }
                        resolve(resp)
                    })
            } catch(err) {
                return reject(err)
            }
        })
    }
    flushAll(){
        return this.client.flushall()
    }
}

module.exports = params => new Cache(params)
module.exports.Class = Cache