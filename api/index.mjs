import appServer from "../lib/app-server.cjs";

const { requestHandler } = appServer;

export default function handler(request, response) {
  return requestHandler(request, response);
}