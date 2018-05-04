require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const app = express();

function log(...args) {
    console.log(new Date().toISOString(), ...args);
}

const STATE_FNAME = process.env.STATE_FNAME || 'last-state.json';
const stateFile = path.join(__dirname, `./${STATE_FNAME}`);

const EXPECTED_HOSTS_COUNT = Number(process.env.EXPECTED_HOSTS_COUNT);
const LAST_FAILED_THRESHOLD = Number(process.env.LAST_FAILED_THRESHOLD_SEC)*1000;
const LAST_UPD_THRESHOLD = Number(process.env.LAST_UPD_THRESHOLD_SEC)*1000;

app.get('/bridge-state', (req, res) => {
    log('---> /bridge-state');
    var reqTime = new Date().getTime();
    var state;
    try {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
    catch (e) {
        if (e.code === 'ENOENT') {
            return res.json({
                ok: false,
                state: {},
            });
        }
        else {
            throw e;
        }
    }

    var ok = true;
    // ************* CHECKS ************* //
    var hostsCount = Object.keys(state).length;
    if (hostsCount !== EXPECTED_HOSTS_COUNT) {
        ok = false;
    }

    for (let hostname in state) {
        if (state[hostname].failed) {
            ok = false;
        }
        else if (reqTime - state[hostname].lastFailed < LAST_FAILED_THRESHOLD) {
            ok = false;
        }
        else if (reqTime - state[hostname].lastUpd < LAST_UPD_THRESHOLD) {
            ok = false;
        }
    }

    var resp = {
        ok,
        hostsCount,
        state
    };
    log('<--- /bridge-state, resp = ' + JSON.stringify(resp));
    res.json({
        ok,
        hostsCount,
        state
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Syslog-tail WEB listening on port ' + PORT));
