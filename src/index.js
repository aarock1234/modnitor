const scriptMonitor = require('./monitor.js');
const webhookManager = require('./actions/webhook.js');

let currentMonitor = new scriptMonitor();

currentMonitor.on('newMod', script => {
    webhookManager.send(1305395, 'New mod.js', script);
    console.log('New Mod.js')
});