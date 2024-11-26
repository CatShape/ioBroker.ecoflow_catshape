'use strict';

const axios = require('axios');
const crypto = require('crypto');
const utils = require('./utils.js');

const stringEcoflowApiUrl = 'https://api-e.ecoflow.com/iot-open/sign/';


async function createIobObjects(ecoflowCatshape) {
    
    let stringKey = '';
    let objConfigDevice = {};
    
    for (stringKey in ecoflowCatshape.objConfigDevices) {
        //ecoflowCatshape.log.debug('stringKey: ' + stringKey);
        objConfigDevice = ecoflowCatshape.objConfigDevices[stringKey];
        //ecoflowCatshape.log.debug('objConfigDevice: ' + JSON.stringify(objConfigDevice));
        
        await ecoflowCatshape.setObjectNotExistsAsync(
            objConfigDevice.serialNumber, {
                type: 'device'
                , common: {
                    name: objConfigDevice.serialNumber
                }
                , native: {}
            }
        );
        
        await ecoflowCatshape.setObjectNotExistsAsync(
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
        
        await ecoflowCatshape.setObjectNotExistsAsync(
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
        
        await ecoflowCatshape.setObjectNotExistsAsync(
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
        
        await ecoflowCatshape.setObjectNotExistsAsync(
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
}


async function requestAllDataAndUpdateStates(ecoflowCatshape, objApiKeys) {
    
    let stringKey = '';
    let objApiKey = {};
    let objA = {};
    let objDevices = {};
    
    for (stringKey in objApiKeys) {
        objApiKey = objApiKeys[stringKey];
        if (!utils.objectIsEmpty(objApiKey)) {
            objA = await getDevices(ecoflowCatshape, objApiKey);
            if (!utils.objectIsEmpty(objA)) {
                objDevices = utils.mergeArrayOfObjectsIntoObject([objDevices, objA]);
            }
        }
    }
    if (!utils.objectIsEmpty(objDevices)) {
        for (stringKey in objDevices) {
            if (!utils.objectIsEmpty(objDevices[stringKey])) {
                objA = objDevices[stringKey];
                ecoflowCatshape.log.debug('objA: ' + JSON.stringify(objA));
                if (ecoflowCatshape.objConfigDevices[stringKey].doNotUpdateOffline && (objA.online != 1)) {
                    updateDeviceOnlineState(ecoflowCatshape, objA);
                    ecoflowCatshape.setStateChanged(stringKey + '.name', objA.deviceName, true);
                    ecoflowCatshape.setStateChanged(stringKey + '.productName', objA.productName, true);
                } else {
                    requestDeviceDataAndUpdateStates(ecoflowCatshape, objA);
                }
            }
        }
    }
}


async function getDevices(ecoflowCatshape, objApiKey) {
    
    let objConfig = {};
    let numLen = 0;
    let indexA = 0;
    let objA = {};
    let objRet = {};
    
    objConfig.url = stringEcoflowApiUrl + 'device/list';
    objConfig.method = 'get';
    
    const objHeaders = getHeaders(objApiKey);
    if (!utils.objectIsEmpty(objHeaders)) {
        objConfig.headers = objHeaders;
    }
    
    objA = await ecoflowRequest(ecoflowCatshape, objConfig);
    if (!utils.objectIsEmpty(objA)) {
        const arrayData = objA.data;
        ecoflowCatshape.log.debug('arrayData: ' + JSON.stringify(arrayData));
        if (arrayData) {
            numLen = arrayData.length;
            for (indexA = 0; indexA < numLen; indexA = indexA + 1) {
                if (!utils.objectIsEmpty(arrayData[indexA])) {
                    objA = arrayData[indexA];
                    if (ecoflowCatshape.objConfigDevices.hasOwnProperty(objA.sn)) {
                        //ecoflowCatshape.log.debug('objA: ' + JSON.stringify(objA));
                        objRet[objA.sn] = objA;
                    }
                }
            }
        }
    }
    return objRet;
}


async function requestDeviceDataAndUpdateStates(ecoflowCatshape, objDevice) {
    
    let objConfig = {};
    let stringA = '';
    let objData = {};
    
    objConfig.url = stringEcoflowApiUrl + 'device/quota/all?sn=' + objDevice.sn;
    objConfig.method = 'get';
    
    const objConfigData = {
        sn: objDevice.sn
    };
    if (!utils.objectIsEmpty(objConfigData)) {
        objConfig.data = objConfigData;
    }
    const objHeaders = getHeaders(ecoflowCatshape.objConfigDevices[objDevice.sn].apiKey, objConfigData);
    if (!utils.objectIsEmpty(objHeaders)) {
        objConfig.headers = objHeaders;
    }
    
    objData = await ecoflowRequest(ecoflowCatshape, objConfig);
    if (!utils.objectIsEmpty(objData)) {
        objData = objData.data;
        if (objData) {
            if (!utils.objectIsEmpty(objData)) {
                //ecoflowCatshape.log.info('objData: ' + JSON.stringify(objData));
                objData = utils.mergeArrayOfObjectsIntoObject([objDevice, objData]);
                updateDeviceStates(ecoflowCatshape, objData);
            }
        }
    }
}


async function sendDeviceState(ecoflowCatshape, stringId, objState) {
    
    const arrayT = stringId.split('.');
    const stringSn = arrayT[2];
    ecoflowCatshape.log.debug('stringSn: ' + stringSn);
    if (!ecoflowCatshape.objConfigDevices.hasOwnProperty(stringSn)) {
        ecoflowCatshape.log.debug('ecoflowCatshape.objConfigDevices.hasOwnProperty(' + stringSn + '): false');
        return;
    }
    if (!(await ecoflowCatshape.getStateAsync(stringSn + '.online')).val) {
        ecoflowCatshape.log.debug('Device not online --> state change not sent: ' + stringId + ': ' + JSON.stringify(objState));
        return;
    }
    const objEcoflowApi = (await ecoflowCatshape.getObjectAsync(stringId)).native.ecoflowApi;
    
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
    ecoflowCatshape.log.debug(stringSn + ', ' + objEcoflowApi.quotaValueKey + ': ' + String(anyValue));
    
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
    const objHeaders = getHeaders(ecoflowCatshape.objConfigDevices[stringSn].apiKey, objConfigData);
    if (!utils.objectIsEmpty(objHeaders)) {
        objConfig.headers = objHeaders;
    }
    ecoflowRequest(ecoflowCatshape, objConfig);
}


async function updateDeviceOnlineState(ecoflowCatshape, objData) {
    
    const stringFullId = objData.sn + '.online';
    const objStateObj = await ecoflowCatshape.getObjectAsync(stringFullId);
    let anyValue = objData.online;
    
    if (objStateObj.native.hasOwnProperty('ecoflowApi')) {
        if (objStateObj.native.ecoflowApi.hasOwnProperty('valueMap')) {
            if (objStateObj.native.ecoflowApi.valueMap.hasOwnProperty(String(anyValue))) {
                anyValue = objStateObj.native.ecoflowApi.valueMap[String(anyValue)];
            }
        }
    }
    ecoflowCatshape.log.debug('ecoflowCatshape.setStateChanged(' + stringFullId + ', ' + String(anyValue) + ', true)');
    ecoflowCatshape.setStateChanged(stringFullId, anyValue, true);
}


async function updateDeviceStates(ecoflowCatshape, objData) {
    
    const stringDeviceId = objData.sn;
    const boolOnline = (await ecoflowCatshape.getStateAsync(stringDeviceId + '.online')).val;
    let stringIdA = stringDeviceId + '.quota';
    let objA = {};
    let stringId = '';
    let objStateObj = {};
    let anyValue;
    let stringA = '';
    let numberA = 0;
    
    let boolA = false;
    if (ecoflowCatshape.objConfigDevices[objData.sn].updateQuotaState) {
        boolA = true;
    } else if (!(await ecoflowCatshape.getStateAsync(stringIdA)).val) {
        boolA = true;
    }
    if (boolA) {
        ecoflowCatshape.setStateChanged(stringIdA, JSON.stringify(objData), true);
    }
    
    objA = await ecoflowCatshape.getStatesAsync(stringDeviceId + '.*');
    for (stringId in objA) {
        objStateObj = await ecoflowCatshape.getObjectAsync(stringId);
        if (objStateObj.native.hasOwnProperty('ecoflowApi')) {
            if (objStateObj.native.ecoflowApi.hasOwnProperty('quotaValueKey')) {
                if (objData.hasOwnProperty(objStateObj.native.ecoflowApi.quotaValueKey)) {
                    anyValue = getValueForState(objData, objStateObj);
                    if ((objData.online == 1) && objStateObj.native.hasOwnProperty('cumulateDailyByTimeId')) {
                        updateCumulateDailyByTime(ecoflowCatshape, stringDeviceId + '.' + objStateObj.native.cumulateDailyByTimeId, anyValue, (await ecoflowCatshape.getStateAsync(stringId)).val, boolOnline);
                    }
                    ecoflowCatshape.setStateChanged(stringId, anyValue, true);
                } else {
                    stringA = stringId + ': native.ecoflowApi.quotaValueKey=' + objStateObj.native.ecoflowApi.quotaValueKey + ' not found in quota received from EcoFlow';
                    ecoflowCatshape.setStateChanged(stringIdA, JSON.stringify(objData), true);
                    if (ecoflowCatshape.arrayQuotaKeyNotFound.includes(stringId)) { // avoid logging the same warning repeatedly
                        ecoflowCatshape.log.debug(stringA);
                    } else {
                        ecoflowCatshape.arrayQuotaKeyNotFound.push(stringId);
                        ecoflowCatshape.log.warn(stringA);
                    }
                }
            }
        }
    }
    stringIdA = stringDeviceId + '.dsgVoltageCurve';
    if (await ecoflowCatshape.objectExists(stringIdA)) {
        objA = JSON.parse((await ecoflowCatshape.getStateAsync(stringIdA)).val);
        const mapA = new Map();
        for (stringA in objA) {
            mapA.set(objA[stringA], {'soc': Number.parseFloat(stringA)});
        }
        const objCurve = await ecoflowCatshape.getObjectAsync(stringIdA);
        objA = await ecoflowCatshape.getObjectAsync(stringDeviceId + '.' + objCurve.native.volId);
        numberA = getValueForState(objData, objA);
        objA = await ecoflowCatshape.getObjectAsync(stringDeviceId + '.' + objCurve.native.ampId);
        numberA = numberA - getValueForState(objData, objA) * objCurve.native.ampCorrectionFactor;
        numberA = utils.interpolateMapLinear(mapA, numberA, 'soc');
        numberA = Math.round(numberA * 10) / 10;
        ecoflowCatshape.setStateChanged(stringDeviceId + '.' + objCurve.native.toStateId, numberA, true);
    }
}


function getValueForState(objData, objStateObj) {
    
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


async function updateCumulateDailyByTime(ecoflowCatshape, stringId, numberNew, numberOld, boolOnline) {
    
    if (!(await ecoflowCatshape.objectExists(stringId))) {
        ecoflowCatshape.log.warn('updateCumulateDailyByTime: object: ' + stringId + ' not found');
        return;
    }
    const dateNow = new Date();
    const numberNowMs = dateNow.getTime();
    const objState = await ecoflowCatshape.getStateAsync(stringId);
    let numberTs = objState.ts;
    const dateTs = new Date(numberTs);
    let numberVal = objState.val;
    
    const numberBod = (new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate()
        , ecoflowCatshape.objCumulateDailyResetTime.hour, ecoflowCatshape.objCumulateDailyResetTime.minute, ecoflowCatshape.objCumulateDailyResetTime.second)).getTime();
    if ((numberTs < numberBod) && (numberNowMs >= numberBod)) {
        numberOld = numberOld + (numberBod - numberTs) * ((numberNew - numberOld) / (numberNowMs - numberTs));
        numberVal = 0;
        numberTs = numberBod;
    }
    if (boolOnline) {
        numberVal = numberVal + (numberOld + numberNew) / 2 * (numberNowMs - numberTs) / 3600000;
    }
    ecoflowCatshape.setState(stringId, {val: numberVal, ack: true, ts: numberNowMs});
}


async function ecoflowRequest(ecoflowCatshape, objConfig) {
    
    ecoflowCatshape.log.debug('Request to Ecoflow: objConfig: ' + JSON.stringify(objConfig));
    try {
        const response = await axios(objConfig);
        
        if (response.status == 200) {
            if (response.data.code == 0) {
                ecoflowCatshape.log.debug('response.data: ' + JSON.stringify(response.data));
                return response.data;
            } else {
                ecoflowCatshape.log.warn('response.data.code: ' + response.data.code.toString() + ' (' + response.data.message + ' )');
            }
        } else {
            ecoflowCatshape.log.warn('response.status: ' + response.status.toString() + ' (' + response.statusText + ' )');
        }
        ecoflowCatshape.log.warn('Request failed: url: ' + objConfig.url + ', method: ' + objConfig.method + ', data: ' + JSON.stringify(objConfig.data));
        return {};
   } catch (error) {
        ecoflowCatshape.log.error('Error');
        //ecoflowCatshape.log.error(error);
        throw error;
    }
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
        if (!utils.objectIsEmpty(objParams)) {
            arrayA = flattenIntoArray('', '=', objParams, '.');
            arrayA.sort();
        }
    }
    arrayA = arrayA.concat(['accessKey=' + objApiKey.accessKey, 'nonce=' + stringNonce, 'timestamp=' + stringTimestamp]);
    stringA = arrayA.join('&');
    //console.log('stringA: ' + stringA, 'debug');
    stringA = crypto.createHmac('sha256', objApiKey.secretKey).update(stringA).digest('hex');
    //console.log('sign: ' + stringA, 'debug');
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
        //console.log('flattenIntoArray: Unsupported value type (' + typeof anyValue + '): ' + String(anyValue), 'warn');
    }
    return arrayRet;
}


exports.createIobObjects = createIobObjects;
exports.requestAllDataAndUpdateStates = requestAllDataAndUpdateStates;
exports.sendDeviceState = sendDeviceState;
