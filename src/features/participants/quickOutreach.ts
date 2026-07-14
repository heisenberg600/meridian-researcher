export type QuickOutreachChannel = "email" | "call";

type Prepare = (args: {
  participantId: string;
  channel: "email" | "voice";
  confirmed: true;
}) => Promise<{ outreachBatchId: string; reused: boolean }>;

type SendEmail = (args: { participantId: string; outreachBatchId: string }) => Promise<{
  emailId: string;
  inviteUrl: string;
}>;

type SendCall = (args: { participantId: string; outreachBatchId: string }) => Promise<
  | { status: "initiated"; conversationId?: string; callSid?: string }
  | { status: "failed"; error: string }
>;

export async function runParticipantQuickOutreach(args: {
  participantId: string;
  channel: QuickOutreachChannel;
  prepare: Prepare;
  sendEmail: SendEmail;
  sendCall: SendCall;
}) {
  const prepared = await args.prepare({
    participantId: args.participantId,
    channel: args.channel === "call" ? "voice" : "email",
    confirmed: true,
  });
  const deliveryArgs = {
    participantId: args.participantId,
    outreachBatchId: prepared.outreachBatchId,
  };

  if (args.channel === "email") {
    const delivery = await args.sendEmail(deliveryArgs);
    return { message: "Invitation email sent.", delivery, prepared };
  }

  const delivery = await args.sendCall(deliveryArgs);
  if (delivery.status === "failed") throw new Error(delivery.error);
  return { message: "Outbound call started.", delivery, prepared };
}
