// Simulator Google Apps Script okolja: naloži PRAVO apps-script/Code_V2.gs in jo požene nad
// pomnilniškim "Sheetom". Uporabljajo ga tests-v2/backend.test.js in tests-v2/e2e.py.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const url = require('url');

function ustvari(opcije) {
    opcije = opcije || {};
    const sheeti = {};
    let casovniPas = 'UTC';
    const predpomnilnik = new Map();
    let zaklenjen = false;
    const stanje = { zahtevkov: 0, formuleVSheetu: 0, zakleni: opcije.zakleni || false };

    function kopiraj(v) {
        if (typeof v === 'string') {
            if (v.startsWith("'")) return v.slice(1); // apostrof = besedilo (kot v Sheetu)
            if (/^[=+\-@]/.test(v)) { stanje.formuleVSheetu++; return '#FORMULA:' + v; }
        }
        return v instanceof Date ? new Date(v.getTime()) : v;
    }

    function SheetObj(ime) {
        this.ime = ime; this.vrstice = [];
    }
    SheetObj.prototype.getName = function () { return this.ime; };
    SheetObj.prototype.appendRow = function (r) { this.vrstice.push(r.map(kopiraj)); };
    SheetObj.prototype.getLastRow = function () { return this.vrstice.length; };
    SheetObj.prototype.getMaxRows = function () { return Math.max(1000, this.vrstice.length); };
    SheetObj.prototype.deleteRow = function (n) { this.vrstice.splice(n - 1, 1); };
    SheetObj.prototype.getDataRange = function () {
        const self = this;
        return { getValues: function () { return self.vrstice.map(function (r) { return r.slice(); }); } };
    };
    SheetObj.prototype.getRange = function (r, c, nr, nc) {
        const self = this; nr = nr || 1; nc = nc || 1;
        return {
            getValues: function () {
                const iz = [];
                for (let i = 0; i < nr; i++) {
                    const vrsta = self.vrstice[r - 1 + i] || [];
                    const o = [];
                    for (let j = 0; j < nc; j++) o.push(vrsta[c - 1 + j] === undefined ? '' : vrsta[c - 1 + j]);
                    iz.push(o);
                }
                return iz;
            },
            setValues: function (vred) {
                for (let i = 0; i < vred.length; i++) {
                    while (self.vrstice.length < r - 1 + i + 1) self.vrstice.push([]);
                    for (let j = 0; j < vred[i].length; j++) self.vrstice[r - 1 + i][c - 1 + j] = kopiraj(vred[i][j]);
                }
            },
            setNumberFormat: function () { return this; }
        };
    };

    const ss = {
        getSheetByName: function (ime) { return sheeti[ime] || null; },
        insertSheet: function (ime) { sheeti[ime] = new SheetObj(ime); return sheeti[ime]; },
        setSpreadsheetTimeZone: function (tz) { casovniPas = tz; },
        getSpreadsheetTimeZone: function () { return casovniPas; }
    };

    const sandbox = {
        console: console,
        Logger: { log: function () {} },
        SpreadsheetApp: { getActiveSpreadsheet: function () { return ss; } },
        ContentService: {
            MimeType: { JSON: 'application/json' },
            createTextOutput: function (t) {
                return { vsebina: t, setMimeType: function () { return this; }, getContent: function () { return this.vsebina; } };
            }
        },
        LockService: {
            getScriptLock: function () {
                return {
                    tryLock: function () { if (stanje.zakleni || zaklenjen) return false; zaklenjen = true; return true; },
                    releaseLock: function () { zaklenjen = false; }
                };
            }
        },
        CacheService: {
            getScriptCache: function () {
                return { get: function (k) { return predpomnilnik.get(k) || null; }, put: function (k, v) { predpomnilnik.set(k, v); } };
            }
        },
        Date: Date, JSON: JSON, Math: Math, Object: Object, String: String, parseFloat: parseFloat, isNaN: isNaN, Array: Array
    };
    vm.createContext(sandbox);
    const koda = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code_V2.gs'), 'utf8');
    vm.runInContext(koda, sandbox, { filename: 'Code_V2.gs' });

    function vJson(izhod) { return JSON.parse(izhod.getContent()); }

    return {
        sheeti: sheeti, stanje: stanje, ss: ss,
        get: function (parametri) { stanje.zahtevkov++; return vJson(sandbox.doGet({ parameter: parametri })); },
        post: function (telo) { stanje.zahtevkov++; return vJson(sandbox.doPost({ postData: { contents: typeof telo === 'string' ? telo : JSON.stringify(telo) } })); },
        pripravi: function () { sandbox.pripraviListe(); },
        sandbox: sandbox
    };
}

/** HTTP strežnik: statične datoteke iz korena repozitorija + /exec kot Apps Script (GET in POST). */
function zagon(mock, port, koren, dodatno) {
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };
    const strezi = http.createServer(function (zahteva, odgovor) {
        const u = url.parse(zahteva.url, true);
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
        if (zahteva.method === 'OPTIONS') { odgovor.writeHead(204, cors); odgovor.end(); return; }
        if (u.pathname === '/__debug/sheet') {
            const l = mock.sheeti[u.query.ime];
            odgovor.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
            odgovor.end(JSON.stringify(l ? l.vrstice : null));
            return;
        }
        if (u.pathname === '/exec') {
            if (dodatno && dodatno.zakasnitev) {
                // simulacija nedosegljivega strežnika (GSM izpad)
            }
            if (dodatno && dodatno.izpad && dodatno.izpad()) { zahteva.socket.destroy(); return; }
            if (zahteva.method === 'POST') {
                let telo = '';
                zahteva.on('data', function (d) { telo += d; });
                zahteva.on('end', function () {
                    odgovor.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
                    odgovor.end(JSON.stringify(mock.post(telo)));
                });
                return;
            }
            odgovor.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
            odgovor.end(JSON.stringify(mock.get(u.query)));
            return;
        }
        const datoteka = path.join(koren, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
        if (!datoteka.startsWith(koren) || !fs.existsSync(datoteka) || fs.statSync(datoteka).isDirectory()) {
            odgovor.writeHead(404); odgovor.end('ni najdeno'); return;
        }
        odgovor.writeHead(200, { 'Content-Type': mime[path.extname(datoteka)] || 'application/octet-stream' });
        fs.createReadStream(datoteka).pipe(odgovor);
    });
    return new Promise(function (resolve) { strezi.listen(port, '127.0.0.1', function () { resolve(strezi); }); });
}

module.exports = { ustvari: ustvari, zagon: zagon };

if (require.main === module) {
    const mock = ustvari();
    mock.pripravi();
    const port = parseInt(process.argv[2] || '8765', 10);
    zagon(mock, port, path.join(__dirname, '..')).then(function () { console.log('Simulator na http://127.0.0.1:' + port); });
}
