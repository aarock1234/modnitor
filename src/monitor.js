"use strict";

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36';
const safeHeaders = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': userAgent
};

const request = require('request-promise').defaults({
    simple: false,
    gzip: true,
    resolveWithFullResponse: true,
    maxRedirects: 0,
    followRedirect: false,
    headers: safeHeaders
});
const crypto = require('crypto');
const esprima = require('esprima');
const { walkAddParent: esprimaWalk } = require('esprima-walk');
const events = require('events');

const {
    sleep,
    formatProxy
} = require('./utils/tools');

const config = require('../user/config.json');
const { resolve } = require('path');

class Monitor extends events {
    constructor() {
        super();

        this.previousChecksum = null;
        this.modContents = null;

        this.proxies = [];

        this.updateInterval = setInterval(() => {
            console.log(`Still monitoring! @ ${new Date()}`)
        }, 1800000); // Status every 30 minutes

        this.initProxies();
    }

    initProxies = async () => {
        require('fs').readFileSync(__dirname + '/../user/proxies.txt', 'utf-8')
            .split(/\r?\n/).forEach(line => this.proxies.push(line));

        this.monitorLoop();
    }

    findMobileMod = async () => {
        const parsedMod = esprima.parse(this.modContents);

        return new Promise(resolve => {
            esprimaWalk(parsedMod, node => {
                if (node.type == 'ObjectExpression') {
                    const property = node.properties[0];
                    resolve({
                        [`${property.key.value}`]: property.value.value
                    })
                }
            })
        })
    }

    monitorLoop = async () => {
        if (this.proxies.length == 0) return console.log('ERR: Please add proxies.');

        if (!config.delay || !config.webhook) return console.log('ERR: Please configure your config.json');

        try {            
            let shaChecksum = await this.getChecksum('https://www.supremenewyork.com/mod.js');

            if (this.previousChecksum == null) {
                console.log(`Initialized Monitor: ${shaChecksum}`);
                this.previousChecksum = shaChecksum;
            }

            if (this.previousChecksum != shaChecksum) {
                const modValue = await this.findMobileMod();

                this.emit('newMod', {
                    shaChecksum,
                    modValue
                })
            }

            await sleep(config.delay);
            return this.monitorLoop();
        } catch (e) {
            console.log(`ERR: ${e.message}`);
            await sleep(config.delay);
            return this.monitorLoop();
        }
    }

    getChecksum = async URL => {
        try {
            let shaChecksum;
        
            URL = (URL.startsWith('//')) ? 'https:' + URL : URL;
            URL = (!URL.startsWith('http')) ? 'https://www.supremenewyork.com' + URL : URL;

            let response = await request({
                url: URL,
                proxy: this.getProxy()
            })

            shaChecksum = crypto.createHash('sha256')
                                .update(response.body)
                                .digest('hex');

            this.modContents = response.body;

            return shaChecksum;
        } catch (e) {
            console.log(`ERR: ${e.message}`);
            await sleep(config.delay);
            return this.getChecksum();
        }
    }

    getProxy = () => {
        return formatProxy(
                    this.proxies[Math.floor(Math.random() * this.proxies.length)]
                );
    }
}

module.exports = Monitor;