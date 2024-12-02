'use strict';


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


function getObjectPropertyLeveled(objA, stringKey) {
    
    let anyValue = null;
    let numberIndex = 0;
    let stringStart = '';
    let stringEnd = '';
    
    if (objA.hasOwnProperty(stringKey)) {
        anyValue = objA[stringKey];
    } else {
        numberIndex = 0;
        while (true) {
            numberIndex = stringKey.indexOf('.', numberIndex + 1);
            if ((numberIndex < 0) || (numberIndex >= stringKey.length - 1)){
                break;
            }
            stringStart = stringKey.substr(0, numberIndex);
            if (objA.hasOwnProperty(stringStart)) {
                stringEnd = stringKey.substr(numberIndex + 1);
                anyValue = getObjectPropertyLeveled(objA[stringStart], stringEnd);
                break;
            }
        }
    }
    return anyValue;
}


function setObjectPropertyLeveled(objA, stringKey, anyValue) {
    
    let boolRet = false;
    let numberIndex = 0;
    let stringStart = '';
    let stringEnd = '';
    
    if (objA.hasOwnProperty(stringKey)) {
        objA[stringKey] = anyValue;
        boolRet = true;
    } else {
        numberIndex = 0;
        while (true) {
            numberIndex = stringKey.indexOf('.', numberIndex + 1);
            if ((numberIndex < 0) || (numberIndex >= stringKey.length - 1)){
                break;
            }
            stringStart = stringKey.substr(0, numberIndex);
            if (objA.hasOwnProperty(stringStart)) {
                stringEnd = stringKey.substr(numberIndex + 1);
                boolRet = setObjectPropertyLeveled(objA[stringStart], stringEnd, anyValue);
                break;
            }
        }
    }
    return boolRet;
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


function evalConditionForObjOfMaps (condition, objOfMaps) { // , compareValueProperty
    
    let boolRet = false;
    let logicalOperator = '&&';
    let numArrayLen = 0;
    let index = 0;
    let boolA = false;
    let code = '';
    let map; // = new Map()
    let atKey = 0;
    let value = 0;
    
    if (condition.hasOwnProperty('conditions')) {
        if (condition.hasOwnProperty('logicalOperator')) {
            logicalOperator = condition.logicalOperator;
        }
        if (['OR', '||'].includes(logicalOperator.toUpperCase())) {
            logicalOperator = '||';
            boolRet = false;
        } else if (['AND', '&&'].includes(logicalOperator.toUpperCase())) {
            logicalOperator = '&&';
            boolRet = true;
        } else {
            code = 'logicalOperator "' + logicalOperator + '" is not supported.';
            //console.log(code, 'error');
            return boolRet;
        }
        numArrayLen = condition.conditions.length;
        for (index = 0; index < numArrayLen; index = index + 1) {
            boolA = evalConditionForObjOfMaps (condition.conditions[index], objOfMaps);
            if (boolA && (logicalOperator === '||')) {
                boolRet = true;
                break;
            } else if (!boolA && (logicalOperator === '&&')) {
                boolRet = false;
                break;
            }
            code = 'boolRet = boolRet ' + logicalOperator + ' boolA';
            eval(code);
        }
    } else {
        // {"mapId": "atKey": -60, "compareProperty": "temperatureC", "compareOperator": ">=", "compareToValue": -1}
        map = objOfMaps[condition.mapId];
        atKey = condition.atKey;
        value = interpolateMapLinear(map, atKey, condition.compareProperty);
        code = 'boolRet = value ' + condition.compareOperator + ' condition.compareToValue;';
        eval(code);
    }
    return boolRet;
}


exports.objectIsEmpty = objectIsEmpty;
exports.mergeArrayOfObjectsIntoObject = mergeArrayOfObjectsIntoObject;
exports.getObjectPropertyLeveled = getObjectPropertyLeveled;
exports.setObjectPropertyLeveled = setObjectPropertyLeveled;
exports.getArrayWithKeysOfMap = getArrayWithKeysOfMap;
exports.interpolateMapLinear = interpolateMapLinear;
exports.evalConditionForObjOfMaps = evalConditionForObjOfMaps;
