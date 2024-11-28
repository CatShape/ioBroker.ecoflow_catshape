'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const adapterCore = require('@iobroker/adapter-core');
const ecoflowUtils = require('./lib/ecoflow_utils.js');

// Load your modules here, e.g.:
// const fs = require("fs");
const cron = require('node-cron');

let requestAllDataInterval = null;


class EcoflowCatshape extends adapterCore.Adapter {
    
    /**
     * @param {Partial<adapterCore.AdapterOptions>} [options={}]
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
        
        this.objConfigDevices = {};
        this.objCumulateDailyResetTime = {};
        this.arrayQuotaKeyNotFound = [];
    }
    
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        
        if (!cron.validate(this.config.cronSchedule)) {
            this.log.error('Config "node-cron schedule" is invalid: ' + this.config.cronSchedule);
            return;
        }
        
        let numApiKeysLen = 0;
        let numA = 0;
        let objA = {};
        let objAllApiKeys = {};
        let numArrayLen = 0;
        let objConfigDevice = {};
        let stringId = '';
        
        try {
            this.objCumulateDailyResetTime = JSON.parse(this.config.cumulateDailyResetTime);
            if (!this.objCumulateDailyResetTime.hasOwnProperty('hour')) {
                this.objCumulateDailyResetTime.hour = 0;
            }
            if (!this.objCumulateDailyResetTime.hasOwnProperty('minute')) {
                this.objCumulateDailyResetTime.minute = 0;
            }
            if (!this.objCumulateDailyResetTime.hasOwnProperty('second')) {
                this.objCumulateDailyResetTime.second = 0;
            }
        } catch (error) {
            this.log.error('Config "Reset time for cumulate daily states" is invalid. It has to be JSON-format. Example: {"hour": 3, "minute": 30}');
            //this.log.error(error);
            return;
        }
        
        numApiKeysLen = this.config.apiKeys.length;
        for (numA = 1; numA <= numApiKeysLen; numA = numA + 1) {
            objA = this.config.apiKeys[numA - 1];
            if (!objA.accessKey) {
                this.log.error('EcoFlow API keys configuration: ' + numA.toFixed(0) + '. "API access key" is empty');
                return;
            }
            if (!objA.secretKey) {
                this.log.error('EcoFlow API keys configuration: ' + numA.toFixed(0) + '. "API secret key" is empty');
                return;
            }
            if (!objA.baseUrl) {
                this.log.error('EcoFlow API keys configuration: ' + numA.toFixed(0) + '. "URL" is empty');
                return;
            }
            objAllApiKeys[numA.toFixed(0)] = objA;
        }
        this.log.debug('objAllApiKeys: ' + JSON.stringify(objAllApiKeys));
        
        numArrayLen = this.config.devices.length;
        if ((numArrayLen > 0) && (numApiKeysLen < 1)) {
            this.log.error('EcoFlow API keys configuration: At least one record is needed');
            return;
        }
        for (numA = 1; numA <= numArrayLen; numA = numA + 1) {
            objConfigDevice = this.config.devices[numA - 1];
            if (!objConfigDevice.serialNumber) {
                this.log.error('EcoFlow devices configuration: ' + numA.toFixed(0) + '. "Device serial number" is empty');
                return;
            }
            if (!objConfigDevice.apiKey) {
                this.log.error('EcoFlow devices configuration: ' + numA.toFixed(0) + '. "API key to use" is empty');
                return;
            }
            if (objConfigDevice.apiKey > numApiKeysLen) {
                objConfigDevice.apiKey = numApiKeysLen;
            }
            objConfigDevice.apiKey = objAllApiKeys[objConfigDevice.apiKey];
            this.objConfigDevices[objConfigDevice.serialNumber] = objConfigDevice;
        }
        this.log.debug('this.objConfigDevices: ' + JSON.stringify(this.objConfigDevices));
        
        
        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await ecoflowUtils.createIobObjects(this, objAllApiKeys);
        
        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        // this.subscribeStates('testVariable');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');
        
        for (stringId in (await this.getStatesAsync('*'))) {
            //this.log.debug('stringId: ' + stringId);
            objA = await this.getObjectAsync(stringId);
            
            if (objA.native.hasOwnProperty('ecoflowApi')) {
                if (objA.native.ecoflowApi.hasOwnProperty('setValueData')) {
                    this.subscribeStates(stringId);
                }
            }
        }
        
        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw iobroker: ' + result);
        
        //result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);
        
        const cronSchedule = cron.schedule(
            this.config.cronSchedule, () => {
                ecoflowUtils.requestAllDataAndUpdateStates(this, objAllApiKeys);
            }
        );
        /*
        requestAllDataInterval = this.setInterval(
            async () => {
                await ecoflowUtils.requestAllDataAndUpdateStates(this, objAllApiKeys);
            }
            , 6000
        );
        */
    }
    
    
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // this.clearTimeout(timeout1);
            // ...
            // this.clearInterval(interval1);
            // ...
            if (requestAllDataInterval) {
                this.clearInterval(requestAllDataInterval);
                this.log.debug('this.clearInterval(requestAllDataInterval)');
            }
            
            if (cronSchedule) {
                cronSchedule.stop();
                this.log.debug('cronSchedule.stop()');
            }
            
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
            /*
            on({id: arrayOfTriggerIds, change: 'ne', ack: false}
                , function(objA) {
                    ecoflowUtils.sendDeviceState(objA);
                }
            );
            */
            this.log.debug('id: ' + id + ', state: ' + JSON.stringify(state));
            if (!state.ack) {
                ecoflowUtils.sendDeviceState(this, id, state);
            }
        } else {
            // The state was deleted
            this.log.debug('state ' + id + ' deleted');
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
     * @param {Partial<adapterCore.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new EcoflowCatshape(options);
} else {
    // otherwise start the instance directly
    new EcoflowCatshape();
}
