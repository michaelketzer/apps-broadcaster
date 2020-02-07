import dotenv from 'dotenv';
dotenv.config();
//@ts-ignore
import Logger from 'simple-node-logger';
import fs from 'fs';
import https from 'https';
import * as Sentry from '@sentry/node';
import {server, connection} from 'websocket';
import uuid from "uuid/v4";

type Connection = connection & {id: string};

const log = Logger.createSimpleLogger('server.log');
const {PORT=8080,CERT_KEY='',CERT_CHAIN='',SENTRY_DSN=null} = process.env;

if(SENTRY_DSN) {
    Sentry.init({ dsn: SENTRY_DSN });
}
 
const webServer = https.createServer({
    cert: fs.readFileSync(CERT_CHAIN),
    key: fs.readFileSync(CERT_KEY)
}, (request, response) => {
    log.info((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

webServer.listen(PORT, () => {
    log.info((new Date()) + ' Server is listening on port ' + PORT);
});
 
const wssServer = new server({
    httpServer: webServer,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});
 
function originIsAllowed(origin: string) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}
 
var connections: {[x: string]: Connection} = {};

wssServer.on('request', (request) => {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      log.info((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    
    var connection = request.accept('echo-protocol', request.origin) as Connection;
    connection.id = uuid();
    connections[connection.id] = connection;

    log.info((new Date()) + ' Connection accepted, with id ' + connection.id);

    connection.on('message', (message) => {
        if (message.type === 'utf8') {
            log.info('Received Message: ' + message.utf8Data);
            broadcast(message.utf8Data!);
        }
    });

    connection.on('close', (reasonCode, description) => {
        log.info((new Date()) + ' Connection ' + connection.id + ' disconnected | Code ' + reasonCode + ' | Description ' + description);
        delete connections[connection.id];
    });
});

// Broadcast to all open connections
function broadcast(data: string) {
    Object.values(connections).forEach((connection) => {
        if (connection.connected) {
            connection.send(data);
        }
    });
}