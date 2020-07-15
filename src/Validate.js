const merge = require('deepmerge')

class Validate {
    constructor(){}
    static array(array, type = 'string', options = {}){
        if(!Array.isArray(array)) throw `Please provide a valid array ${options.label ? `for ${options.label}` : ''}`

        // is Empty?
        if(!array.length) throw `Please provide elements in the array ${options.label ? `for ${options.label}` : ''}`

        // Validate elements
        const errors = []
        array.forEach(element => {
                try {
                    (Validate[type] || Validate.string)(element, options)
                } catch(err) {
                    errors.push(err)
                }
            })
        
        // Exit if errors, else return
        if(errors.length) throw errors
        return array

    }
    static object(obj, options = {}){
        if(typeof obj != "object") throw `Please provide a valid object ${options.label ? `for ${options.label}` : ''}`

        if(options.objValidation) {
            const errors = []
            Object.keys(options.objValidation).forEach(key => {
                const element = options.objValidation[key]
                const type = typeof element == "string" ? element : element[type];

                try {
                    (Validate[element] || Validate.string)( obj[key],  typeof element.options == "object" ? { ...options, ...element.options } : options )
                } catch(err) {
                    errors.push(err)
                }
            })

            
            // Exit if errors, else return
            if(errors.length) throw errors
        }

        // All valid
        return obj
    }
    static file(file, options = {}){
        options.label = options.label || 'File'
        return Validate._validate(file, merge(options, {
            custom: file => {
                if(Buffer.isBuffer(file)) return file
                if(typeof file == "string"){
                    if(file.match("base64")) return file
                    if (/(^|[\s.:;?\-\]<(])(https?:\/\/[-\w;/?:@&=+$|_.!~*|'()[\]%#,☺]+[\w/#](\(\))?)(?=$|[\s',|().:;?\-[\]>)])/.test(file)) return file
                }
            }
        }))
    }
    static image(image, options = {}){
        options.label = options.label || 'Image'
        return Validate._validate(image, options)
    }
    static phone(phone = '', options = {}){
        options.label = options.label || 'Phone'
        // Parse phone if object
        if(typeof phone == "object") phone = `+${phone.ext}.${phone.number}${phone.ext ? `x${phone.ext}` : ''}`
        // Validate string
        return Validate._validate(phone, merge(options, {
            regexp:  /^\+[0-9]{1,3}.[0-9]{4,14}(?:x.+)?$/
        }))
    }
    static email(phone = '', options = {}){
        options.label = options.label || 'Email'
        return Validate._validate(phone, merge(options, {
            regexp:  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/igm
        }))

    }
    static uuid(uuid = '', options = {}){
        options.label = options.label || 'UUID'
        return Validate._validate(uuid, merge(options, {
            regexp: /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i
        }))
    }
    static slug(slug = '', options = {}){
        options.label = options.label || 'Slug'
        return Validate._validate(slug, merge(options, {
            regexp: /^[a-z0-9-]+$/
        }))
    }
    static rfc(rfc = '', options = {}){
        options.label = options.label || 'RFC'
        options.rfcGenerico = options.rfcGenerico || true

        return Validate._validate(rfc, merge(options, {
            custom: str => {

                options.regexp =/^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/
                var validado  = str.match( options.regexp)
                if(!options.regexp.test(str)) return false

                //Separar el dígito verificador del resto del RFC
                const digitoVerificador = validado.pop(),
                    rfcSinDigito      = validado.slice(1).join(''),
                    len               = rfcSinDigito.length,

                //Obtener el digito esperado
                    diccionario       = "0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ",
                    indice            = len + 1
                var suma,
                    digitoEsperado
                if (len == 12) suma = 0
                else suma = 481; //Ajuste para persona moral

                for(var i=0; i<len; i++)
                    suma += diccionario.indexOf(rfcSinDigito.charAt(i)) * (indice - i);
                digitoEsperado = 11 - suma % 11;
                if (digitoEsperado == 11) digitoEsperado = 0;
                else if (digitoEsperado == 10) digitoEsperado = "A";

                //El dígito verificador coincide con el esperado?
                // o es un RFC Genérico (ventas a público general)?
                if ((digitoVerificador != digitoEsperado)
                && (!options.rfcGenerico || rfcSinDigito + digitoVerificador != "XAXX010101000"))
                    return false;
                else if (!options.rfcGenerico  && rfcSinDigito + digitoVerificador == "XEXX010101000")
                    return false;
                return true;


            }
        }))
    }
    static password(hash = '', options = {}){
        options.label = options.label || 'Password'

        return Validate._validate(hash, merge(options, {
            regexp: /^[A-Fa-f0-9]{128}$/
        }))
    }
    static number(input, options = {}){
        if(typeof input == 'string' && /^(-?\d+\.\d+)$|^(-?\d+)$/.test(input.trim())) input = parseFloat(input)
        
        return Validate._validate(input, merge(options, {
            // Aditional validation
            custom: val => {
                if(typeof val == 'string') return /^(-?\d+\.\d+)$|^(-?\d+)$/.test(val.trim())

                return true;
            }
        }))
    }
    static string(str = '', options = {}){
        // Alias
        return Validate._validate(str, options)
    }
    static _validate(input, options = {}){
        // Assign options.msg if doesn't exists
        const msg = options.msg || {}

        // Empty check
        if(!options.optional && (typeof input == "undefined" || input === '' || (typeof input == "object" && !(input || "").length))) throw msg.empty || `The value of ${options.label || 'an input'} is empty!`

        // Lenth validations
        if(options.length){
            const lengthOption = options.length

            var length
            switch(typeof input){
                case 'string':
                    length = input.length
                    break
                case 'object':
                    if(Array.isArray(input)){
                        length = input.length
                    } else {
                        length = Object.keys(input).length
                    }
                    break
                case 'number':
                    length = input
                    break
                default:
                    throw "Please provide a valid input for the length option"
            }

            if(typeof length == "number" && isNaN(length) && options.optional){
                // Ignore length options
            } else
            if(typeof lengthOption == "object"){
                if(lengthOption.min) if(length < lengthOption.min) throw msg.length || `Please provide a ${options.label || 'value'} with a valid size`
                if(lengthOption.max) if(length > lengthOption.max) throw msg.length || `Please provide a ${options.label || 'value'} with a valid size`
            } else 
            if( lengthOption != length) throw msg.length || `Please provide a ${options.label || 'value'} with a valid size`
        }

        // Is Valid input? (RegExp || match || enum || custom)
        if(options.regexp instanceof RegExp){
            if(!options.regexp.test(input)) throw msg.regexp || `Please provide a valid ${options.label || 'value'}`
        }
        if(options.match){
            if(input != options.match) throw msg.match || `The value ${options.label ? `of ${options.label}` : ''} doesn't match with the comparator`
        }
        if(options.enum){
            const validInput = (Array.isArray(options.enum)) ? options.enum.includes(input) : options.enum[input]
            if(!validInput) throw msg.enum || `Please provide a valid option${options.label ? ` for ${options.label}` : ''}`
        }
        if(typeof options.custom == "function"){
            const customResult = options.custom(input, options)
            if(customResult === false || typeof customResult == "undefined") throw msg.custom || `Please provide a valid ${options.label || 'value'}`
        }
        return input
    }


    
    static dataInput(input, type = 'string', options = {}){
        try {
            return Validate[type](input, options)
        } catch(err){
            return;
        }
    }
    static isValidData(data, ignore = []){
        const errors = []

        Object.keys(data).forEach(key => {
            if(typeof data[key] == 'undefined' && !ignore.includes(key)) errors.push(key)
        })

        // Throw errors if something failed
        if(errors.length) throw errors

        // Is valid!
        return true
    }
}

module.exports = Validate