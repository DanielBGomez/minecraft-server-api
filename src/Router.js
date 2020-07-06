// Modules
const Express = require('express')
const Router = Express.Router()

// Local Modules
const Validate = require('./Validate')

// Routes
Router.get('/kick/:player', (req, res, next) => {
    try {
        Validate.string(req.params.player, { label: 'Player', regex: /^(?:@[aeprs]|[A-Za-z_]{1,16})$/ })
    } catch { 
        return res.status(400).send("INVALID_PLAYER")
    }

    // Execute command
    req.api.kickPlayer({
            player: req.params.player,
            reason: req.query.reason
        })
        .then(res.send)
        .catch(err => {
            res.status(409).send(err)
        })
})

Router.get('/playsound', (req, res, next) => {
    // Execute command
    req.api.playSound(req.query)
        .then(res.send)
        .catch(err => {
            res.status(409).send(err)
        })

})

Router.get('/tp', (req, res) => {
    // Execute command
    req.api.tpPlayer(req.query)
        .then(res.send)
        .catch(err => {
            res.status(409).send(err)
        })
})

// Exports
module.exports = Router