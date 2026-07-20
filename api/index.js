const { requestHandler } = require("../lib/app-server.cjs");

module.exports = (request, response) => requestHandler(request, response);
