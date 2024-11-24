![Logo](admin/ecoflow_catshape.png)
# ioBroker.ecoflow_catshape

[![NPM version](https://img.shields.io/npm/v/iobroker.ecoflow_catshape.svg)](https://www.npmjs.com/package/iobroker.ecoflow_catshape)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ecoflow_catshape.svg)](https://www.npmjs.com/package/iobroker.ecoflow_catshape)
![Number of Installations](https://iobroker.live/badges/ecoflow_catshape-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/ecoflow_catshape-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.ecoflow_catshape.png?downloads=true)](https://nodei.co/npm/iobroker.ecoflow_catshape/)

## ecoflow_catshape adapter for ioBroker

ioBroker adapter based on the official EcoFlow HTTP-API (https://developer-eu.ecoflow.com). 

Provides communication with products from EcoFlow (https://www.ecoflow.com) within the ioBroker software (https://www.iobroker.net).

## WARNING

This adapter uses the official EcoFlow HTTP-API (https://developer-eu.ecoflow.com) and therefore depends on the maintenance of said API by EcoFlow.

Use at own risk.

The adapter is based on:
* https://developer-eu.ecoflow.com/us/document/introduction

## Configuration

### node-cron schedule for getting data from EcoFlow
Examples: ``` */10 * * * * * ``` (every 10 seconds). For more information please visit: https://github.com/node-cron/node-cron/blob/master/README.md
    
### Reset time for cumulate daily states (state gets set to 0 at this time)
Example: ``` {"hour": 3, "minute": 1, "second": 3} ```


## Changelog

### 0.0.1
* (CatShape) initial release

## License
MIT License

Copyright (c) 2024 CatShape

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
