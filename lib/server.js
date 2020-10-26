/**
 * Server related tasks
 *
 */

// Dependencies
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const url = require("url");
const StringDecoder = require("string_decoder").StringDecoder;
const config = require("./config");
const handlers = require("./handlers");
const helpers = require("./helpers");

// Instatiante server module object
const server = {};

// Instantiate http server
server.httpServer = http.createServer((req, res) => {
  server.unifiedServer(req, res);
});

// https server options
server.httpServerOptions = {
  key: fs.readFileSync(path.join(__dirname, "/../https/key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "/../https/cert.pem")),
};

// Instantiate https server
server.httpsServer = https.createServer(
  server.httpServerOptions,
  (req, res) => {
    server.unifiedServer(req, res);
  }
);

// Logic for http and https services
server.unifiedServer = (req, res) => {
  // Get the url and parse it
  const parsedUrl = url.parse(req.url, true);

  // Get the path
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, "");

  // Get the query string object
  const queryStringObject = parsedUrl.query;

  // Get the http method
  const method = req.method.toLocaleUpperCase();

  // Get the headers object
  const headers = req.headers;

  // Get the payload
  const decoder = new StringDecoder("utf-8");

  let buffer = "";

  // If there is any payload...
  req.on("data", (data) => {
    buffer += decoder.write(data);
  });

  req.on("end", () => {
    buffer += decoder.end();

    // Choose appropriate handler. If none is found, use the not-found handler
    const chosenHandler =
      typeof server.router[trimmedPath] !== "undefined"
        ? server.router[trimmedPath]
        : handlers.notFound;

    // Construct the data object to send to the router
    const data = {
      trimmedPath: trimmedPath,
      queryStringObject: queryStringObject,
      method: method,
      headers: headers,
      payload: helpers.parseJsonToObject(buffer),
    };

    // Route specified request
    chosenHandler(data, (statusCode, payload) => {
      // Use status code called back by the handler, or default to 200
      statusCode = typeof statusCode === "number" ? statusCode : 200;

      // Use the payload called back by the handler or default to empty object
      payload = typeof payload === "object" ? payload : {};

      // Convert the payload to a string
      const payloadString = JSON.stringify(payload);

      // Return the response
      res.setHeader("Content-Type", "application/json");
      res.writeHead(statusCode);
      res.end(payloadString);

      // If response is 200, print green, else print red
      if (statusCode == 200) {
        console.log(
          "\x1b[32m%s\x1b[0m",
          method.toUpperCase() + " /" + trimmedPath + " " + statusCode
        );
      } else
        console.log(
          "\x1b[31m%s\x1b[0m",
          method.toUpperCase() + " /" + trimmedPath + " " + statusCode
        );
    });
  });
};

// ROUTERS

// Define a request handler
server.router = {
  users: handlers.users,
  tokens: handlers.tokens,
};

// Init script
server.init = () => {
  // Start HTTP server
  server.httpServer.listen(config.httpPort, () => {
    console.log(
      "\x1b[36m%s\x1b[0m",
      `Listening on port ${config.httpPort} [${config.envName}]`
    );
  });

  // Start HTTPS server
  server.httpsServer.listen(config.httpsPort, () => {
    console.log(
      "\x1b[36m%s\x1b[0m",
      `Listening on port ${config.httpsPort} [${config.envName}]`
    );
  });
};

// Export server module
module.exports = server;
