import dotenv from 'dotenv';
dotenv.config();
//@ts-ignore
import Logger from 'simple-node-logger';
import WebSocket from 'ws';
import fs from 'fs';
import https from 'https';
import * as Sentry from '@sentry/node';
const log = Logger.createSimpleLogger('server.log');

const {PORT=8080,CERT_KEY='',CERT_CHAIN='',SENTRY_DSN=null} = process.env;

if(SENTRY_DSN) {
    Sentry.init({ dsn: SENTRY_DSN });
}

interface HeartbetWS extends WebSocket {
    isAlive: boolean;
}

const server = https.createServer({
    cert: fs.readFileSync(CERT_CHAIN),
    key: fs.readFileSync(CERT_KEY)
});

const wss = new WebSocket.Server({server});

wss.on('connection', (ws: HeartbetWS): void => {
    log.info('New connection established.');
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    ws.on('message', (data: string): void => {
        log.info(`Received message: [${data}] broadcasting to all clients.`);
        wss.clients.forEach(clients => clients.send(data));
    });
});

function ping(): void {
    (wss.clients as Set<HeartbetWS>).forEach((ws): void => {
        if (ws.isAlive === false) {
            log.info('Closing connection as heartbeat failed');
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping(noop);
    });

    setTimeout(ping, 30000);
}

function noop(): void {}
function heartbeat(ws: HeartbetWS): void {
    ws.isAlive = true;
}

server.listen(PORT);
log.info('Server started up');
log.info('=================');

setTimeout(ping, 30000);
