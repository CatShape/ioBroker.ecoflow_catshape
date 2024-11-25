'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");
const axios = require('axios');
const crypto = require('crypto');
const cron = require('node-cron');

const stringEcoflowApiUrl = 'https://api-e.ecoflow.com/iot-open/sign/';
const arrayQuotaKeyNotFound = [];

let requestAllDataInterval = null;


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
        this.objConfigDevices = {};
        this.objCumulateDailyResetTime = {};
    }
    
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //const stringSched = '3,9,15,21,27,33,39,45,51,57 * * * * *';
        if (!cron.validate(this.config.cronSchedule)) {
            this.log.error('Config "node-cron schedule" is invalid: ' + this.config.cronSchedule);
            return;
        }
        
        let numA = 0;
        let numArrayLen = 0;
        let objConfigDevice = {};
        let stringKey = '';
        let stringId = '';
        let objStateObj = {};
        
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
        
        numArrayLen = this.config.apiKeys.length;
        if (numArrayLen < 1) {
            this.log.error('Config "API keys" at least one entry is needed');
            return;
        }
        for (numA = 1; numA <= numArrayLen; numA = numA + 1) {
            this.objAllApiKeys[numA.toFixed(0)] = this.config.apiKeys[numA - 1];
        }
        this.log.debug('this.objAllApiKeys: ' + JSON.stringify(this.objAllApiKeys));
        
        numArrayLen = this.config.devices.length;
        if (numArrayLen < 1) {
            this.log.error('Config "EcoFlow devices" at least one entry is needed');
            return;
        }
        for (numA = 0; numA < numArrayLen; numA = numA + 1) {
            objConfigDevice = this.config.devices[numA];
            //objConfigDevice.apiKey = this.objAllApiKeys[objConfigDevice.apiKey];
            this.objConfigDevices[objConfigDevice.serialNumber] = objConfigDevice;
        }
        this.log.debug('this.objConfigDevices: ' + JSON.stringify(this.objConfigDevices));
        
        
        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        
        for (stringKey in this.objConfigDevices) {
            //this.log.debug('stringKey: ' + stringKey);
            objConfigDevice = this.objConfigDevices[stringKey];
            //this.log.debug('objConfigDevice: ' + JSON.stringify(objConfigDevice));
            
            await this.setObjectNotExistsAsync(
                objConfigDevice.serialNumber, {
                    type: 'device'
                    , common: {
                        name: objConfigDevice.serialNumber
                    }
                    , native: {}
                }
            );
            
            await this.setObjectNotExistsAsync(
                objConfigDevice.serialNumber + '.name', {
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
                objConfigDevice.serialNumber + '.online', {
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
                objConfigDevice.serialNumber + '.productName', {
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
                objConfigDevice.serialNumber + '.quota', {
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
        
        const objA = await this.getStatesAsync('*');
        for (stringId in objA) {
            //this.log.debug('stringId: ' + stringId);
            objStateObj = await this.getObjectAsync(stringId);
            
            if (objStateObj.native.hasOwnProperty('ecoflowApi')) {
                if (objStateObj.native.ecoflowApi.hasOwnProperty('setValueData')) {
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
                this.requestAllDataAndUpdateStates(this.objAllApiKeys);
            }
        );
        /*
        requestAllDataInterval = this.setInterval(
            async () => {
                await this.requestAllDataAndUpdateStates(this.objAllApiKeys);
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
            
            if(cronSchedule) {
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
                    sendDeviceState(objA);
                }
            );
            */
            this.log.debug('id: ' + id + ', state: ' + JSON.stringify(state));
            if (!state.ack) {
                this.sendDeviceState(id, state);
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
    
    
    
    async requestAllDataAndUpdateStates(objApiKeys) {
        
        let stringKey = '';
        let objApiKey = {};
        let objA = {};
        let objDevices = {};
        
        for (stringKey in objApiKeys) {
            objApiKey = objApiKeys[stringKey];
            if (!objectIsEmpty(objApiKey)) {
                objA = await this.getDevices(objApiKey);
                if (!objectIsEmpty(objA)) {
                    objDevices = mergeArrayOfObjectsIntoObject([objDevices, objA]);
                }
            }
        }
        if (!objectIsEmpty(objDevices)) {
            for (stringKey in objDevices) {
                if (!objectIsEmpty(objDevices[stringKey])) {
                    objA = objDevices[stringKey];
                    this.log.debug('objA: ' + JSON.stringify(objA));
                    if (this.objConfigDevices[stringKey].doNotUpdateOffline && (objA.online != 1)) {
                        this.updateDeviceOnlineState(objA);
                        this.setStateChanged(stringKey + '.name', objA.deviceName, true);
                        this.setStateChanged(stringKey + '.productName', objA.productName, true);
                    } else {
                        this.requestDeviceDataAndUpdateStates(objA);
                    }
                }
            }
        }
    }
    
    
    async getDevices(objApiKey) {
        
        let objConfig = {};
        let numLen = 0;
        let indexA = 0;
        let objA = {};
        let objRet = {};
        
        objConfig.url = stringEcoflowApiUrl + 'device/list';
        objConfig.method = 'get';
        
        const objHeaders = getHeaders(objApiKey);
        if (!objectIsEmpty(objHeaders)) {
            objConfig.headers = objHeaders;
        }
        
        objA = await this.ecoflowRequest(objConfig);
        if (!objectIsEmpty(objA)) {
            const arrayData = objA.data;
            this.log.debug('arrayData: ' + JSON.stringify(arrayData));
            if (arrayData) {
                numLen = arrayData.length;
                for (indexA = 0; indexA < numLen; indexA = indexA + 1) {
                    if (!objectIsEmpty(arrayData[indexA])) {
                        objA = arrayData[indexA];
                        if (this.objConfigDevices.hasOwnProperty(objA.sn)) {
                            //this.log.debug('objA: ' + JSON.stringify(objA));
                            objRet[objA.sn] = objA;
                        }
                    }
                }
            }
        }
        return objRet;
    }
    
    
    async requestDeviceDataAndUpdateStates(objDevice) {
        
        let objConfig = {};
        let stringA = '';
        let objData = {};
        
        objConfig.url = stringEcoflowApiUrl + 'device/quota/all?sn=' + objDevice.sn;
        objConfig.method = 'get';
        
        const objConfigData = {
            sn: objDevice.sn
        };
        if (!objectIsEmpty(objConfigData)) {
            objConfig.data = objConfigData;
        }
        stringA = this.objConfigDevices[objDevice.sn].apiKey;
        const objHeaders = getHeaders(this.objAllApiKeys[stringA], objConfigData);
        if (!objectIsEmpty(objHeaders)) {
            objConfig.headers = objHeaders;
        }
        
        objData = await this.ecoflowRequest(objConfig);
        if (!objectIsEmpty(objData)) {
            objData = objData.data;
            if (objData) {
                if (!objectIsEmpty(objData)) {
                    //this.log.info('objData: ' + JSON.stringify(objData));
                    objData = mergeArrayOfObjectsIntoObject([objDevice, objData]);
                    this.updateDeviceStates(objData);
                }
            }
        }
    }
    
    
    async sendDeviceState(stringId, objState) {
        
        const arrayT = stringId.split('.');
        const stringSn = arrayT[2];
        this.log.debug('stringSn: ' + stringSn);
        if (!this.objConfigDevices.hasOwnProperty(stringSn)) {
            this.log.debug('this.objConfigDevices.hasOwnProperty(' + stringSn + '): false');
            return;
        }
        if (!(await this.getStateAsync(stringSn + '.online')).val) {
            this.log.debug('Device not online --> state change not sent: ' + stringId + ': ' + JSON.stringify(objState));
            return;
        }
        const objEcoflowApi = (await this.getObjectAsync(stringId)).native.ecoflowApi;
        
        let anyValue;
        let stringA = '';
        let numberA = 0;
        let numberLen = 0;
        let objConfig = {};
        let objConfigData = objEcoflowApi.setValueData;
        let arrayA = [];
        let objA = {};
        let indexA = 0;
        
        anyValue = objState.val;
        if (objEcoflowApi.hasOwnProperty('valueMap')) {
            for (stringA in objEcoflowApi.valueMap) {
                if (objEcoflowApi.valueMap[stringA] == anyValue) {
                    anyValue = stringA;
                    break;
                }
            }
        } else if (objEcoflowApi.hasOwnProperty('valueFactor')) {
            anyValue = (anyValue / objEcoflowApi.valueFactor).toFixed(4);
            numberA = 0;
            numberLen = anyValue.length;
            while (anyValue.endsWith('0', numberLen - numberA)) {
                numberA = numberA + 1;
            }
            anyValue = anyValue.substring(0, numberLen - numberA)
        }
        this.log.debug(stringSn + ', ' + objEcoflowApi.quotaValueKey + ': ' + String(anyValue));
        
        objConfig.url = stringEcoflowApiUrl + 'device/quota';
        objConfig.method = 'put'; // put post
        
        if (objConfigData.hasOwnProperty('sn')) {
            objConfigData.sn = stringSn;
        }
        stringA = objEcoflowApi.setValueKey;
        arrayA = stringA.split('.');
        numberLen = arrayA.length - 1;
        objA = objConfigData;
        for (indexA = 0; indexA < numberLen; indexA = indexA + 1) {
            objA = objA[arrayA[indexA]];
        }
        objA[arrayA[numberLen]] = anyValue;
        
        objConfig.data = objConfigData;
        stringA = this.objConfigDevices[stringSn].apiKey;
        const objHeaders = getHeaders(this.objAllApiKeys[stringA], objConfigData);
        if (!objectIsEmpty(objHeaders)) {
            objConfig.headers = objHeaders;
        }
        this.ecoflowRequest(objConfig);
    }
    
    
    async updateDeviceOnlineState(objData) {
        
        const stringFullId = objData.sn + '.online';
        const objStateObj = await this.getObjectAsync(stringFullId);
        let anyValue = objData.online;
        
        if (objStateObj.native.hasOwnProperty('ecoflowApi')) {
            if (objStateObj.native.ecoflowApi.hasOwnProperty('valueMap')) {
                if (objStateObj.native.ecoflowApi.valueMap.hasOwnProperty(String(anyValue))) {
                    anyValue = objStateObj.native.ecoflowApi.valueMap[String(anyValue)];
                }
            }
        }
        this.log.debug('this.setStateChanged(' + stringFullId + ', ' + String(anyValue) + ', true)');
        this.setStateChanged(stringFullId, anyValue, true);
    }
    
    
    async updateDeviceStates(objData) {
        
        const stringDeviceId = objData.sn;
        const boolOnline = (await this.getStateAsync(stringDeviceId + '.online')).val;
        let stringIdA = stringDeviceId + '.quota';
        let objA = {};
        let stringId = '';
        let objStateObj = {};
        let anyValue;
        let stringA = '';
        let numberA = 0;
        
        let boolA = false;
        if (this.objConfigDevices[objData.sn].updateQuotaState) {
            boolA = true;
        } else if (!(await this.getStateAsync(stringIdA)).val) {
            boolA = true;
        }
        if (boolA) {
            this.setStateChanged(stringIdA, JSON.stringify(objData), true);
        }
        
        objA = await this.getStatesAsync(stringDeviceId + '.*');
        for (stringId in objA) {
            objStateObj = await this.getObjectAsync(stringId);
            if (objStateObj.native.hasOwnProperty('ecoflowApi')) {
                if (objStateObj.native.ecoflowApi.hasOwnProperty('quotaValueKey')) {
                    if (objData.hasOwnProperty(objStateObj.native.ecoflowApi.quotaValueKey)) {
                        anyValue = this.getValueForState(objData, objStateObj);
                        if ((objData.online == 1) && objStateObj.native.hasOwnProperty('cumulateDailyByTimeId')) {
                            this.setCumulateDailyByTime(stringDeviceId + '.' + objStateObj.native.cumulateDailyByTimeId, anyValue, (await this.getStateAsync(stringId)).val, boolOnline);
                        }
                        this.setStateChanged(stringId, anyValue, true);
                    } else if (!arrayQuotaKeyNotFound.includes(stringId)) {
                        stringA = stringId + ': native.ecoflowApi.quotaValueKey=' + objStateObj.native.ecoflowApi.quotaValueKey + ' not found in quota-object';
                        this.log.warn(stringA);
                        arrayQuotaKeyNotFound.push(stringId);
                    }
                }
            }
        }
        stringIdA = stringDeviceId + '.dsgVoltageCurve';
        if (await this.objectExists(stringIdA)) {
            objA = JSON.parse((await this.getStateAsync(stringIdA)).val);
            const mapA = new Map();
            for (stringA in objA) {
                mapA.set(objA[stringA], {'soc': Number.parseFloat(stringA)});
            }
            const objCurve = await this.getObjectAsync(stringIdA);
            objA = await this.getObjectAsync(stringDeviceId + '.' + objCurve.native.volId);
            numberA = this.getValueForState(objData, objA);
            objA = await this.getObjectAsync(stringDeviceId + '.' + objCurve.native.ampId);
            numberA = numberA - this.getValueForState(objData, objA) * objCurve.native.ampCorrectionFactor;
            numberA = interpolateMapLinear(mapA, numberA, 'soc');
            numberA = Math.round(numberA * 10) / 10;
            this.setStateChanged(stringDeviceId + '.' + objCurve.native.toStateId, numberA, true);
        }
    }
    
    
    getValueForState(objData, objStateObj) {
        
        let anyValue = objData[objStateObj.native.ecoflowApi.quotaValueKey];
        if (objStateObj.native.ecoflowApi.hasOwnProperty('valueMap')) {
            if (objStateObj.native.ecoflowApi.valueMap.hasOwnProperty(String(anyValue))) {
                anyValue = objStateObj.native.ecoflowApi.valueMap[String(anyValue)];
            }
        } else if (objStateObj.native.ecoflowApi.hasOwnProperty('valueFactor')) {
            anyValue = Number.parseFloat((anyValue * objStateObj.native.ecoflowApi.valueFactor).toFixed(4));
        }
        return anyValue;
    }
    
    
    async setCumulateDailyByTime(stringId, numberNew, numberOld, boolOnline) {
        
        if (!(await this.objectExists(stringId))) {
            this.log.warn('setCumulateDailyByTime: object: ' + stringId + ' not found');
            return;
        }
        const dateNow = new Date();
        const numberNowMs = dateNow.getTime();
        const objState = await this.getStateAsync(stringId);
        let numberTs = objState.ts;
        const dateTs = new Date(numberTs);
        let numberVal = objState.val;
        
        const numberBod = (new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate()
            , this.objCumulateDailyResetTime.hour, this.objCumulateDailyResetTime.minute, this.objCumulateDailyResetTime.second)).getTime();
        if ((numberTs < numberBod) && (numberNowMs >= numberBod)) {
            numberOld = numberOld + (numberBod - numberTs) * ((numberNew - numberOld) / (numberNowMs - numberTs));
            numberVal = 0;
            numberTs = numberBod;
        }
        if (boolOnline) {
            numberVal = numberVal + (numberOld + numberNew) / 2 * (numberNowMs - numberTs) / 3600000;
        }
        this.setState(stringId, {val: numberVal, ack: true, ts: numberNowMs});
    }
    
    
    async ecoflowRequest(objConfig) {
        
        this.log.debug('Request to Ecoflow: objConfig: ' + JSON.stringify(objConfig));
        try {
            const response = await axios(objConfig);
            
            if (response.status == 200) {
                if (response.data.code == 0) {
                    this.log.debug('response.data: ' + JSON.stringify(response.data));
                    return response.data;
                } else {
                    this.log.warn('response.data.code: ' + response.data.code.toString() + ' (' + response.data.message + ' )');
                }
            } else {
                this.log.warn('response.status: ' + response.status.toString() + ' (' + response.statusText + ' )');
            }
            this.log.warn('Request failed: url: ' + objConfig.url + ', method: ' + objConfig.method + ', data: ' + JSON.stringify(objConfig.data));
            return {};
       } catch (error) {
            this.log.error('Error');
            //this.log.error(error);
            throw error;
        }
    }
    
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
    //log('stringA: ' + stringA, 'debug');
    stringA = crypto.createHmac('sha256', objApiKey.secretKey).update(stringA).digest('hex');
    //log('sign: ' + stringA, 'debug');
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
    } else if (['string', 'number', 'boolean'].includes(stringType)) {
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
