import { httpRouter } from "convex/server";
import { dodoWebhook } from "./paymentWebhookHttp";

const http = httpRouter();

http.route({
  path: "/dodo/webhooks",
  method: "POST",
  handler: dodoWebhook,
});

export default http;
