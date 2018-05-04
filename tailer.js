require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const DEBUG = process.env.DEBUG? true : false;
if (DEBUG) {
    function debugLog(...args) {
        console.log(new Date().toISOString(), ...args);
    }
}
else {
    function debugLog() {}
}

// ************* STATE ************* //
const state = {};
function updateState(opts) {
    if (!state[opts.hostname]) {
        state[opts.hostname] = {
            failed: false,
            lastFailed: 0,
            lastExitCode: 0,
        };
    }
    if (opts.failed === true) {
        state[opts.hostname].failed = true;
        state[opts.hostname].lastFailed = new Date().getTime();
        state[opts.hostname].lastExitCode = opts.exitCode;
    }
    else if (opts.failed === false) {
        state[opts.hostname].failed = false;
    }
    state[opts.hostname].lastUpd = new Date().getTime();
}

// ************* STATE FILE ************* //
const STATE_FNAME = process.env.STATE_FNAME || 'last-state.json';
const SAVE_INTERVAL = (Number(process.env.SAVE_INTERVAL_SEC) || 60)*1000;
const stateFile = path.join(__dirname, `./${STATE_FNAME}`);
function saveSate() {
    debugLog('Saving state to: ' + stateFile);
    state.lastSaved = new Date().getTime();
    fs.writeFileSync(stateFile, JSON.stringify(state));
    debugLog('Saving state: done');
}
setInterval(saveSate, SAVE_INTERVAL);

// ************* PARSING ************* //
var rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
});
// Example, bridge failing:
// May  4 07:58:44 Test-Bridge-Depl-4 systemd[1]: bridge.service: Main process exited, code=exited, status=3/NOTIMPLEMENTED
//
// Example, bridge started:
// May  4 07:59:20 Test-Bridge-Depl-4 systemd[1]: Started bridge.
const YEAR = 2018;
function parseLine(line) {
    var symbs = line.split(/\s+/);
    var date = new Date(`${YEAR} ${symbs[0]} ${symbs[1]} ${symbs[2]}`).getTime();
    var hostname = symbs[3];
    var appname = symbs[4].split('[')[0];
    return {
        line,
        date,
        hostname,
        appname,
    };
}

var counter = 0;
rl.on('line', line => {
    //debugLog('Counter = ' + (counter++) + ': ' + line);
    var parsed = parseLine(line);
    if (parsed.appname === 'systemd') {
        if (parsed.line.toLowerCase().indexOf('bridge.service: main process exited') >= 0) {
            console.log('Bridge exited, setting state to FAILED: ' + parsed.line);
            var exitCode = parsed.line.split('status=')[1];
            updateState({
                hostname: parsed.hostname,
                failed: true,
                exitCode,
            });
        }
        else if (parsed.line.toLowerCase().indexOf('started bridge') >= 0) {
            console.log('Bridge started, setting state to OK: ' + parsed.line);
            updateState({
                hostname: parsed.hostname,
                failed: false,
            });
        }
    }
    else if (parsed.appname === 'bridge') {
        if (parsed.line.toLowerCase().indexOf('fetching messages and signatures') >= 0) {
            debugLog('Bridge is up, fetching messages: ' + parsed.line);
            updateState({
                hostname: parsed.hostname,
                failed: false,
            });
        }
        else {
            debugLog('Some other message from bridge: ' + parsed.line);
            updateState({
                hostname: parsed.hostname,
            });
        }
    }
});
