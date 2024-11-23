'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");

const stringEcoflowApiUrl = 'https://api-e.ecoflow.com/iot-open/sign/';


class EcoflowCatshape extends utils.Adapter {
    
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'ecoflow_catshape',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
        
        this.objAllApiKeys = {};
        this.objDevices = {};
        this.objCumulateDailyResetTime = {};
    }
    
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //this.log.info('config cumulateDailyResetTime: ' + typeof this.config.cumulateDailyResetTime);
        //this.log.info('config scheduleRules: ' + typeof this.config.scheduleRules[0]);
        
        let numA = 0;
        let numArrayLen = this.config.apiKeys;
        let objDevice = {};
        let stringKey = '';
        
        this.objCumulateDailyResetTime = JSON.parse(this.config.cumulateDailyResetTime);
        
        for (numA = 1; numA <= numArrayLen; numA = numA + 1) {
            this.objAllApiKeys[numA.toFixed(0)] = this.config.apiKeys[numA - 1];
        }
        this.log.info('this.objAllApiKeys: ' + JSON.stringify(this.objAllApiKeys));
        
        for (numA = 0; numA < numArrayLen; numA = numA + 1) {
            objDevice = this.config.devices[numA];
            //objDevice.apiKey = this.objAllApiKeys[objDevice.apiKey];
            this.objDevices[objDevice.serialNumber] = objDevice;
        }
        this.log.info('this.objDevices: ' + JSON.stringify(this.objDevices));
        
        
        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        
        for (stringKey in this.objDevices) {
            this.log.info('stringKey: ' + stringKey);
            objDevice = this.objDevices[stringKey];
            this.log.info('objDevice: ' + JSON.stringify(objDevice));
            
            await this.setObjectNotExistsAsync(
                objDevice.serialNumber, {
                    type: 'device'
                    , common: {
                        name: objDevice.serialNumber
                    }
                    , native: {}
                }
            );
            
            await this.setObjectNotExistsAsync(
                objDevice.serialNumber + '.name', {
                    type: 'state'
                    , common: {
                        type: 'string'
                        , name: 'Name'
                        , desc: 'Device name'
                        , role: 'state'
                        , read: true
                        , write: false
                    }
                    , native: {
                        ecoflowApi: {
                            quotaValueKey: 'deviceName'
                        }
                    }
                }
            );
            
            await this.setObjectNotExistsAsync(
                objDevice.serialNumber + '.online', {
                    type: 'state'
                    , common: {
                        type: 'boolean'
                        , name: 'Online'
                        , desc: 'Device is online'
                        , role: 'state'
                        , read: true
                        , write: false
                    }
                    , native: {
                        ecoflowApi: {
                            quotaValueKey: 'online'
                            , valueMap: {
                                '0': false
                                , '1': true
                            }
                        }
                    }
                }
            );
            
            await this.setObjectNotExistsAsync(
                objDevice.serialNumber + '.productName', {
                    type: 'state'
                    , common: {
                        type: 'string'
                        , name: 'Product name'
                        , desc: 'Product name'
                        , role: 'state'
                        , read: true
                        , write: false
                    }
                    , native: {
                        ecoflowApi: {
                            quotaValueKey: 'productName'
                        }
                    }
                }
            );
            
            await this.setObjectNotExistsAsync(
                objDevice.serialNumber + '.quota', {
                    type: 'state'
                    , common: {
                        type: 'string'
                        , name: 'Quota'
                        , desc: 'Quota'
                        , role: 'state'
                        , read: true
                        , write: false
                    }
                    , native: {}
                }
            );
        }
        
        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        // this.subscribeStates('testVariable');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');
        
        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync('testVariable', true);
        
        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('testVariable', { val: true, ack: true });
        
        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });
        
        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw iobroker: ' + result);
        
        result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);
    }
    
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
        
            callback();
        } catch (e) {
            callback();
        }
    }
    
    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }
    
    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    
    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');
    //
    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }
    
    
}


if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new EcoflowCatshape(options);
} else {
    // otherwise start the instance directly
    new EcoflowCatshape();
}


function getHeaders(objApiKey, objData) {
    
    const dateNow = new Date();
    const stringTimestamp = dateNow.getTime().toFixed(0);
    const stringNonce = Math.floor(Math.random() * 1000000).toFixed(0).padStart(6, '0');
    
    let stringA = '';
    
    stringA = getSignature(objApiKey, objData, stringNonce, stringTimestamp);
    
    return {
        accessKey: objApiKey.accessKey
        , nonce: stringNonce
        , timestamp: stringTimestamp
        , sign: stringA
        , 'Content-Type': 'application/json;charset=UTF-8'
    };
}


function getSignature(objApiKey, objParams, stringNonce, stringTimestamp) {
    
    let arrayA = [];
    let stringA = '';
    
    if (objParams) {
        if (!objectIsEmpty(objParams)) {
            arrayA = flattenIntoArray('', '=', objParams, '.');
            arrayA.sort();
        }
    }
    arrayA = arrayA.concat(['accessKey=' + objApiKey.accessKey, 'nonce=' + stringNonce, 'timestamp=' + stringTimestamp]);
    stringA = arrayA.join('&');
    //log('stringA: ' + stringA, 'info');
    stringA = crypto.createHmac('sha256', objApiKey.secretKey).update(stringA).digest('hex');
    //log('sign: ' + stringA, 'info');
    return stringA;
}


function flattenIntoArray(stringKey, stringSeparator, anyValue, stringJoinKey) {
    
    let stringType = typeof anyValue;
    let arrayRet = [];
    let indexA = 0;
    let stringPrefix = '';
    let stringA = '';
    
    if (Array.isArray(anyValue)) {
        for (indexA = 0; indexA < anyValue.length; indexA = indexA + 1) {
            arrayRet = arrayRet.concat(flattenIntoArray(stringKey + '[' + indexA.toFixed(0) + ']', stringSeparator, anyValue[indexA], stringJoinKey));
        }
    } else if (stringType == 'object') {
        if (stringKey != '') {
            stringPrefix = stringKey + stringJoinKey;
        }
        for (stringA in anyValue) {
            arrayRet = arrayRet.concat(flattenIntoArray(stringPrefix + stringA, stringSeparator, anyValue[stringA], stringJoinKey));
        }
    } else if (stringType == 'string') {
        arrayRet = [stringKey + stringSeparator + anyValue];
    } else if (stringType == 'number') {
        arrayRet = [stringKey + stringSeparator + anyValue.toString()];
    } else {
        log('flattenIntoArray: Unsupported value type (' + typeof anyValue + '): ' + String(anyValue), 'warn');
    }
    return arrayRet;
}


function objectIsEmpty(objA) {
    
    return (Object.keys(objA).length === 0);
}


function mergeArrayOfObjectsIntoObject(arrayOfObjects) {
    
    const numLen = arrayOfObjects.length
    
    let objRet = {};
    let index = 0;
    let stringKey = '';
    
    for (index = 0; index < numLen; index = index + 1) {
        for (stringKey in arrayOfObjects[index]) {
            if (!objRet.hasOwnProperty(stringKey)) {
                objRet[stringKey] = arrayOfObjects[index][stringKey];
            }
        }
    }
    return objRet;
}


function getArrayWithKeysOfMap(map, valueProperty) {
    
    const arrayRet = [];
    let arrayA = [];
    
    for (arrayA of map.entries()) {
        if (arrayA[1].hasOwnProperty(valueProperty)) {
            arrayRet.push(arrayA[0]);
        }
    }
    return arrayRet;
}


// Examples: map with (key, value) pairs: 
// (-3, {prop1: 5, prop2: 120}), (-1, {prop1: 0, prop2: 365}), (4, {prop2: 72}), (9, {prop1: 20, prop2: 66}), (10, {prop1: 20, prop2: 2})
// interpolateMapLinear(map, 7, 'prop1') returns 16
// interpolateMapLinear(map, -9, 'prop1') returns 20
function interpolateMapLinear(map, atKey, valueProperty) {
    
    const arrayKeys = getArrayWithKeysOfMap(map, valueProperty);
    if (arrayKeys.includes(atKey)) {
        return map.get(atKey)[valueProperty];
    }
    
    const arrayKeysLen = arrayKeys.length
    
    if (arrayKeysLen === 1) {
        return map.get(arrayKeys[0])[valueProperty];
    }
    
    let retValue = 0;
    let index = 0;
    let key1 = 0;
    let key2 = 0;
    let value1 = 0;
    let value2 = 0;
    
    arrayKeys.sort(function(num1, num2) {return num1 - num2});
    
    key1 = arrayKeys[arrayKeysLen - 2];
    key2 = arrayKeys[arrayKeysLen - 1];
    for (index = 1; index < arrayKeysLen - 1; index = index + 1) {
        if (atKey < arrayKeys[index]) {
            key1 = arrayKeys[index - 1];
            key2 = arrayKeys[index];
            break;
        }
    }
    value1 = map.get(key1)[valueProperty];
    value2 = map.get(key2)[valueProperty];
    retValue = value1 + (atKey - key1) * ((value2 - value1) / (key2 - key1));
    return retValue;
}
