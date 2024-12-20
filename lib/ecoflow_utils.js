'use strict';

const axios = require('axios');
const crypto = require('crypto');
const utils = require('./utils.js');


async function createIobObjects(ecoflowCatshape, objApiKeys) {
    
    let stringKey = '';
    let objA = {};
    let objDevices = {};
    let stringSn = '';
    let stringName = '';
    let stringDesc = '';
    let objDevice = {};
    
    for (stringKey in objApiKeys) {
        if (!utils.objectIsEmpty(objApiKeys[stringKey])) {
            objA = await getDevices(ecoflowCatshape, objApiKeys[stringKey]);
            if (!utils.objectIsEmpty(objA)) {
                objDevices = utils.mergeArrayOfObjectsIntoObject([objDevices, objA]);
            }
        }
    }
    
    for (stringSn in ecoflowCatshape.objConfigDevices) {
        stringName = stringSn;
        stringDesc = '';
        if (objDevices.hasOwnProperty(stringSn)) {
            objDevice = objDevices[stringSn];
            if (!utils.objectIsEmpty(objDevice)) {
                ecoflowCatshape.log.debug('objDevice: ' + JSON.stringify(objDevice));
                stringName = objDevice.deviceName;
                stringDesc = objDevice.productName;
            }
        }
        
        await ecoflowCatshape.setObjectNotExistsAsync(
            stringSn, {
                type: 'device'
                , common: {
                    name: stringName
                    , desc: stringDesc
                    , statusStates: {onlineId: ecoflowCatshape.namespace + '.' + stringSn + '.online'}
                }
                , native: {}
            }
        );
        
        await ecoflowCatshape.setObjectNotExistsAsync(
            stringSn + '.name', {
                type: 'state'
                , common: {
                    type: 'string'
                    , name: 'Name'
                    , desc: 'Device name'
                    , role: 'state'
                    , read: true
                    , write: false
                    , def: stringSn
                }
                , native: {
                    ecoflowApi: {
                        quotaValueKey: 'deviceName'
                    }
                }
            }
        );
        
        await ecoflowCatshape.setObjectNotExistsAsync(
            stringSn + '.online', {
                type: 'state'
                , common: {
                    type: 'boolean'
                    , name: 'Online'
                    , desc: 'Device is online'
                    , role: 'state'
                    , read: true
                    , write: false
                    , def: false
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
            stringSn + '.productName', {
                type: 'state'
                , common: {
                    type: 'string'
                    , name: 'Product name'
                    , desc: 'Product name'
                    , role: 'state'
                    , read: true
                    , write: false
                    , def: ''
                }
                , native: {
                    ecoflowApi: {
                        quotaValueKey: 'productName'
                    }
                }
            }
        );
        
        await ecoflowCatshape.setObjectNotExistsAsync(
            stringSn + '.quota', {
                type: 'state'
                , common: {
                    type: 'string'
                    , name: 'Quota'
                    , desc: 'Quota'
                    , role: 'state'
                    , read: true
                    , write: false
                    , def: ''
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
                    if (await ecoflowCatshape.objectExists(stringKey + '.name')) {
                        ecoflowCatshape.setStateChanged(stringKey + '.name', objA.deviceName, true);
                    }
                    if (await ecoflowCatshape.objectExists(stringKey + '.productName')) {
                        ecoflowCatshape.setStateChanged(stringKey + '.productName', objA.productName, true);
                    }
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
    
    objConfig.baseURL = objApiKey.baseUrl;
    objConfig.url = '/iot-open/sign/device/list';
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
    
    objConfig.baseURL = ecoflowCatshape.objConfigDevices[objDevice.sn].apiKey.baseUrl;
    objConfig.url = '/iot-open/sign/device/quota/all?sn=' + objDevice.sn;
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
    let boolA = false;
    let objA = await ecoflowCatshape.getStateAsync(stringSn + '.online');
    if (objA) {
        boolA = objA.val;
    } else {
        boolA = false;
        ecoflowCatshape.log.warn('Device state "' + stringSn + '.online" missing or has no value --> Assume device is not online !');
    }
    if (!boolA) {
        ecoflowCatshape.log.debug('Device not online --> state change not sent: ' + stringId + ': ' + JSON.stringify(objState));
        return;
    }
    const objStateObj = (await ecoflowCatshape.getObjectAsync(stringId));
    const objEcoflowApi = objStateObj.native.ecoflowApi;
    
    let objConfig = {};
    let objConfigData = objEcoflowApi.setValueData;
    let stringA = '';
    let stringTempId = '';
    let anyValue;
    
    objConfig.baseURL = ecoflowCatshape.objConfigDevices[stringSn].apiKey.baseUrl;
    objConfig.url = '/iot-open/sign/device/quota';
    objConfig.method = 'put';
    
    if (objConfigData.hasOwnProperty('sn')) {
        objConfigData.sn = stringSn;
    }
    
    if (objEcoflowApi.hasOwnProperty('valuesForSetValueData')) {
        for (stringA in objEcoflowApi.valuesForSetValueData) {
            stringTempId = stringSn + '.' + objEcoflowApi.valuesForSetValueData[stringA];
            if (await ecoflowCatshape.objectExists(stringTempId)) {
                anyValue = getApiValueFromStateValueWithObject(ecoflowCatshape, (await ecoflowCatshape.getStateAsync(stringTempId)).val
                    , await ecoflowCatshape.getObjectAsync(stringTempId));
                if (!utils.setObjectPropertyLeveled(objConfigData, stringA, anyValue)) {
                    ecoflowCatshape.log.warn('native.ecoflowApi.valuesForSetValueData: "' + stringA + '" not found in ' + JSON.stringify(objConfigData) 
                        + '. (Processing state change "' + stringId + '")');
                    return;
                }
            } else {
                ecoflowCatshape.log.warn('State "' + stringTempId + '" not found' 
                    + '. (Processing state change "' + stringId + '": native.ecoflowApi.valuesForSetValueData.' + stringA + ')');
                return;
            }
        }
    }
    
    anyValue = getApiValueFromStateValueWithObject(ecoflowCatshape, objState.val, objStateObj);
    //ecoflowCatshape.log.debug(stringSn + ', ' + objEcoflowApi.setValueKey + ': ' + String(anyValue));
    if (!utils.setObjectPropertyLeveled(objConfigData, objEcoflowApi.setValueKey, anyValue)) {
        ecoflowCatshape.log.warn('native.ecoflowApi.setValueKey: "' + objEcoflowApi.setValueKey + '" not found in ' + JSON.stringify(objConfigData) 
            + '. (Processing state change "' + stringId + '")');
        return;
    }
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
    let boolA = false;
    let objA = await ecoflowCatshape.getStateAsync(stringDeviceId + '.online');
    if (objA) {
        boolA = objA.val;
    } else {
        boolA = false;
        ecoflowCatshape.log.warn('Device state "' + stringDeviceId + '.online" missing or has no value --> Assume device is not online !');
    }
    const boolOnline = boolA;
    let stringIdA = stringDeviceId + '.quota';
    let stringId = '';
    let objStateObj = {};
    let anyValue;
    let stringA = '';
    let numberA = 0;
    
    boolA = false;
    if (await ecoflowCatshape.objectExists(stringIdA)) {
        if (ecoflowCatshape.objConfigDevices[objData.sn].updateQuotaState) {
            boolA = true;
        } else {
            objA = await ecoflowCatshape.getStateAsync(stringIdA);
            if (!objA) {
                boolA = true;
            } else if (!objA.val) {
                boolA = true;
            }
        }
    }
    if (boolA) {
        ecoflowCatshape.setStateChanged(stringIdA, JSON.stringify(objData), true);
    }
    
    objA = await ecoflowCatshape.getStatesAsync(stringDeviceId + '.*');
    for (stringId in objA) {
        objStateObj = await ecoflowCatshape.getObjectAsync(stringId);
        if (objStateObj.native.hasOwnProperty('ecoflowApi')) {
            if (objStateObj.native.ecoflowApi.hasOwnProperty('quotaValueKey')) {
                anyValue = getStateValueFromApi(objData, objStateObj.native.ecoflowApi);
                if (anyValue === null) {
                    stringA = stringId + ': native.ecoflowApi.quotaValueKey=' + objStateObj.native.ecoflowApi.quotaValueKey + ' not found in quota received from EcoFlow';
                    ecoflowCatshape.setStateChanged(stringIdA, JSON.stringify(objData), true);
                    if (ecoflowCatshape.arrayQuotaKeyNotFound.includes(stringId)) { // avoid logging the same warning repeatedly
                        ecoflowCatshape.log.debug(stringA);
                    } else {
                        ecoflowCatshape.arrayQuotaKeyNotFound.push(stringId);
                        ecoflowCatshape.log.warn(stringA);
                    }
                } else {
                    if ((objData.online == 1) && objStateObj.native.hasOwnProperty('cumulateDailyByTimeId')) {
                        updateCumulateDailyByTime(ecoflowCatshape, stringDeviceId, objStateObj
                            , anyValue, (await ecoflowCatshape.getStateAsync(stringId)).val, boolOnline);
                    }
                    if (typeof anyValue == 'object') {
                        try {
                            //ecoflowCatshape.log.info('typeof anyValue: ' + typeof anyValue);
                            //ecoflowCatshape.log.info('JSON.stringify(anyValue): ' + JSON.stringify(anyValue)); // ToDo
                            anyValue = JSON.stringify(anyValue);
                        } catch (error) {
                            ecoflowCatshape.log.info('error: ' + JSON.stringify(error));
                        }
                    }
                    ecoflowCatshape.setStateChanged(stringId, anyValue, true);
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
        numberA = getStateValueFromApi(objData, objA.native.ecoflowApi);
        objA = await ecoflowCatshape.getObjectAsync(stringDeviceId + '.' + objCurve.native.ampId);
        numberA = numberA - getStateValueFromApi(objData, objA.native.ecoflowApi) * objCurve.native.ampCorrectionFactor;
        numberA = utils.interpolateMapLinear(mapA, numberA, 'soc');
        numberA = Math.round(numberA * 10) / 10;
        ecoflowCatshape.setStateChanged(stringDeviceId + '.' + objCurve.native.toStateId, numberA, true);
    }
}


function getStateValueFromApi(objData, objEcoflowApi) {
    
    let anyValue = utils.getObjectPropertyLeveled(objData, objEcoflowApi.quotaValueKey);
    
    if (!(anyValue === null)) {
        if (objEcoflowApi.hasOwnProperty('valueMap')) {
            if (objEcoflowApi.valueMap.hasOwnProperty(String(anyValue))) {
                anyValue = objEcoflowApi.valueMap[String(anyValue)];
            }
        } else if (objEcoflowApi.hasOwnProperty('valueFactor')) {
            anyValue = Number.parseFloat((anyValue * objEcoflowApi.valueFactor).toFixed(4));
        }
    }
    return anyValue;
}


function getApiValueFromStateValueWithObject(ecoflowCatshape, anyValue, objStateObj) {
    
    let anyRet = anyValue;
    let objA = {};
    
    if (objStateObj.native.hasOwnProperty('ecoflowApi')) {
        anyRet = getApiValueFromStateValue(anyRet, objStateObj.native.ecoflowApi);
    }
    if ((objStateObj.common.type == 'object') && (typeof anyRet == 'string')) {
        try {
            objA = JSON.parse(anyRet);
            anyRet = objA;
        } catch (error) {
            ecoflowCatshape.log.warn('JSON.parse(' + anyRet + ') fails. State (' + objStateObj._id + ') of type object');
        }
    }
    return anyRet;
}


function getApiValueFromStateValue(anyValue, objEcoflowApi) {
    
    let stringA = '';
    let anyRet = anyValue;
    let numberA = 0;
    let numberLen = 0;
    
    if (objEcoflowApi.hasOwnProperty('valueMap')) {
        for (stringA in objEcoflowApi.valueMap) {
            if (objEcoflowApi.valueMap[stringA] == anyValue) {
                anyRet = stringA;
                break;
            }
        }
    } else if (objEcoflowApi.hasOwnProperty('valueFactor')) {
        anyRet = (anyValue / objEcoflowApi.valueFactor).toFixed(4);
        numberA = 0;
        numberLen = anyRet.length;
        while (anyRet.endsWith('0', numberLen - numberA)) {
            numberA = numberA + 1;
        }
        anyRet = anyRet.substring(0, numberLen - numberA)
    }
    return anyRet;
}


async function updateCumulateDailyByTime(ecoflowCatshape, stringDeviceId, objSrcStateObj, numberNew, numberOld, boolOnline) {
    
    const stringId = stringDeviceId + '.' + objSrcStateObj.native.cumulateDailyByTimeId
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
    let objCumulateDailyResetTime = {};
    
    if (objSrcStateObj.native.hasOwnProperty('cumulateDailyResetTime')) {
        objCumulateDailyResetTime = objSrcStateObj.native.cumulateDailyResetTime;
    } else {
        const objDevice = await ecoflowCatshape.getObjectAsync(stringDeviceId);
        if (objDevice.native.hasOwnProperty('cumulateDailyResetTime')) {
            objCumulateDailyResetTime = objDevice.native.cumulateDailyResetTime;
        } else {
            objCumulateDailyResetTime = ecoflowCatshape.objConfigCumulateDailyResetTime;
        }
    }    
    const numberBod = (new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate()
        , objCumulateDailyResetTime.hour, objCumulateDailyResetTime.minute, objCumulateDailyResetTime.second)).getTime();
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


async function updateDeviceObjName(ecoflowCatshape, stringSn, stringName) {
    
    const objDevice = await ecoflowCatshape.getObjectAsync(stringSn);
    
    objDevice.common.name = stringName;
    ecoflowCatshape.setObject(
        stringSn, objDevice, function (error) {
            if (error) {
                ecoflowCatshape.log.error('Error in ecoflowCatshape.setObject(' + stringSn + '): ' + JSON.stringify(error));
            }
        }
    );
}


async function ecoflowRequest(ecoflowCatshape, objConfig) {
    
    const stringFailed = 'Request failed: ' + JSON.stringify(objConfig);
    let objRet = {};
    
    ecoflowCatshape.log.debug('Request to Ecoflow: objConfig: ' + JSON.stringify(objConfig));
    try {
        const response = await axios(objConfig);
        
        if (response.status == 200) {
            if (response.data.code == 0) {
                ecoflowCatshape.log.debug('response.data: ' + JSON.stringify(response.data));
                objRet = response.data;
            } else {
                ecoflowCatshape.log.warn(stringFailed + ', response.data.code: ' + response.data.code.toString() + ' (' + response.data.message + ' )');
            }
        } else {
            ecoflowCatshape.log.warn(stringFailed + ', response.status: ' + response.status.toString() + ' (' + response.statusText + ' )');
        }
    } catch (error) {
        ecoflowCatshape.log.error('error: ' + JSON.stringify(error));
        /*
        ecoflowCatshape.log.info('error.config: ' + JSON.stringify(error.config));
        if (error.response) {
            ecoflowCatshape.log.error('error.response.status: ' + error.response.status);
            ecoflowCatshape.log.error('error.response.headers: ' + JSON.stringify(error.response.headers));
            ecoflowCatshape.log.error('error.response.data: ' + JSON.stringify(error.response.data));
        } else if (error.request) {
            ecoflowCatshape.log.error('error.request: ' + JSON.stringify(error.request));
        } else {
            ecoflowCatshape.log.error('error.message: ' + error.message);
        }
        //throw error;
        */
    }
    return objRet;
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
exports.updateDeviceObjName = updateDeviceObjName;
