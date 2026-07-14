# Participant Quick Outreach Design

## Outcome

Email and Call on a participant row perform real Resend and ElevenLabs outbound delivery. They remain unavailable only when the selected participant lacks the required contact field or another delivery is already in progress.

## Interaction

Selecting Email or Call opens an accessible confirmation dialog naming the participant, channel, and irreversible external action. Confirming performs the complete governed workflow and reports success or a specific recoverable error inline. The control shows progress and prevents double submission.

## Backend flow

A single authenticated preparation mutation atomically validates the approved questionnaire, contact method, suppression/consent state, and organization ownership. For a manually added participant it creates the approved synthetic participant batch. It then creates and launches a one-participant outreach batch with the confirmed channel, recording approval and audit events. It may reuse an equivalent running batch on retry.

After preparation, the existing `participantInvites.sendEmail` or `participantInvites.sendCall` action performs the provider request using the running batch ID. Provider guards remain mandatory; no client can call Resend or ElevenLabs without the launched snapshot.

## Error and retry behavior

- Missing email or phone disables only the incompatible channel.
- Missing approved questionnaire produces an actionable inline error.
- Suppressed, declined, archived, or cross-workspace participants are rejected before provider delivery.
- A provider failure leaves the approved running batch reusable so the user can retry without rebuilding approval state.
- Repeated preparation reuses a compatible running batch instead of creating duplicate approval records.

## Verification

Backend tests cover manual participant preparation, existing approved batches, running-fieldwork retries, missing contacts, and guard preservation. Frontend tests cover confirmation and orchestration without live provider requests. The full unit/backend suite, lint, build, and configured browser smoke tests must pass before push.
