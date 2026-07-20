const { requestHandler } = require("../app-server");

module.exports = (request, response) => requestHandler(request, response);
