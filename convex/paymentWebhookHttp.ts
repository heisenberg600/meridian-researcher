import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";

const verifyAndProcessRef = makeFunctionReference<
  "action",
  { rawBody: string; eventId: string; signature: string; timestamp: string },
  { status: number; message: string }
>("paymentWebhookActions:verifyAndProcess");

export const dodoWebhook = httpAction(async (ctx, request) => {
  const eventId = request.headers.get("webhook-id")?.trim() ?? "";
  const signature = request.headers.get("webhook-signature")?.trim() ?? "";
  const timestamp = request.headers.get("webhook-timestamp")?.trim() ?? "";
  const result = await ctx.runAction(verifyAndProcessRef, {
    rawBody: await request.text(),
    eventId,
    signature,
    timestamp,
  });
  return new Response(JSON.stringify({ status: result.message }), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
});
