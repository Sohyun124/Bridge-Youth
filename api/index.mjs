import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const server = require("../server.js");

export default function handler(request, response) {
  server.emit("request", request, response);
}