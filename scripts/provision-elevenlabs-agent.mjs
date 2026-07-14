#!/usr/bin/env node
/* global console, fetch, process */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

loadDotenv(".env.local");
loadDotenv(".env");

const apiKey = process.env.ELEVENLABS_API_KEY;
const existingAgentId = process.env.ELEVENLABS_AGENT_ID;
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
const shouldSetConvexEnv = process.argv.includes("--set-convex-env");
const convexDeployment = getConvexDeploymentName(process.env.CONVEX_DEPLOYMENT);

if (!apiKey) {
  throw new Error("Missing ELEVENLABS_API_KEY. Add it to .env.local or export it before running.");
}

const payload = {
  name: "Meridian Research Interviewer",
  tags: ["meridian", "research", "interview", "public-demo"],
  conversation_config: {
    agent: {
      first_message:
        "Hi, I am Meridian. I will ask a few short research questions and keep this neutral. Ready to begin?",
      language: "en",
      prompt: {
        prompt: buildPrompt(),
        llm: "gemini-2.0-flash",
        temperature: 0.4,
        tools: [],
      },
      disable_first_message_interruptions: false,
    },
    tts: {
      voice_id: voiceId,
      model_id: "eleven_turbo_v2",
      optimize_streaming_latency: 3,
      stability: 0.5,
      speed: 1,
      similarity_boost: 0.8,
    },
    conversation: {
      max_duration_seconds: 600,
      client_events: ["audio", "interruption"],
    },
    turn: {
      mode: "turn",
      turn_timeout: 7,
      silence_end_call_timeout: -1,
    },
  },
};

const agentUrl = existingAgentId
  ? `${ELEVENLABS_BASE_URL}/convai/agents/${existingAgentId}`
  : `${ELEVENLABS_BASE_URL}/convai/agents/create`;
const response = await fetch(agentUrl, {
  method: existingAgentId ? "PATCH" : "POST",
  headers: {
    "Content-Type": "application/json",
    "xi-api-key": apiKey,
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`ElevenLabs agent ${existingAgentId ? "update" : "create"} failed: ${response.status} ${errorText}`);
}

const result = await response.json();
const agentId = result?.agent_id;

if (typeof agentId !== "string" || agentId.length === 0) {
  throw new Error(`ElevenLabs response did not include agent_id: ${JSON.stringify(result)}`);
}

console.log(`${existingAgentId ? "Updated" : "Created"} ElevenLabs agent: ${agentId}`);

if (shouldSetConvexEnv) {
  const command = ["exec", "convex", "env", "set"];
  if (convexDeployment) {
    command.push("--deployment", convexDeployment);
  }
  command.push("ELEVENLABS_AGENT_ID", agentId);

  execFileSync("pnpm", command, {
    stdio: "inherit",
  });
}

function buildPrompt() {
  return [
    "You are Meridian, a neutral customer research interviewer.",
    "You run short adaptive interviews for product and research teams.",
    "Ask one clear question at a time. Keep questions unbiased, concrete, and easy to answer aloud.",
    "Use the dynamic variables passed at session start to understand the study context:",
    "- invite_id: {{invite_id}}",
    "- study_title: {{study_title}}",
    "- research_goal: {{research_goal}}",
    "- learning_objectives: {{learning_objectives}}",
    "- respondent_label: {{respondent_label}}",
    "- estimated_minutes: {{estimated_minutes}}",
    "- answer_count: {{answer_count}}",
    "- answers_json: {{answers_json}}",
    "You own the interview flow. Decide every question yourself from the research goal, objectives, and what the respondent has already said.",
    "Start broad, listen carefully, and ask a short follow-up when it could uncover a concrete example, motivation, constraint, or tradeoff.",
    "Do not follow a fixed questionnaire and do not announce question numbers or answer choices.",
    "Avoid repeating topics already covered in answers_json. Cover the learning objectives naturally within the available time.",
    "After each answer, continue naturally with the most useful next question or short probe. Do not call client tools; the platform records the full transcript.",
    "Aim for roughly five substantive topics, adapting depth to the estimated time. When the objectives are sufficiently covered, briefly summarize what you heard, ask if anything important was missed, and thank the respondent.",
    "If the respondent asks to stop, thank them and end the call.",
    "Do not sell, persuade, diagnose, or ask for sensitive personal information.",
    "If unsure, ask a brief clarification rather than inventing details.",
  ].join("\n");
}

function loadDotenv(filename) {
  const path = resolve(filename);
  if (!existsSync(path)) return;

  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = stripInlineComment(trimmed.slice(separatorIndex + 1).trim());
    if (!key || process.env[key] != null) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function stripInlineComment(value) {
  if (value.startsWith('"') || value.startsWith("'")) return value;
  return value.replace(/\s+#.*$/, "").trim();
}

function getConvexDeploymentName(value) {
  if (!value) return null;
  const cleaned = stripInlineComment(value).trim();
  if (cleaned.startsWith("dev:")) return cleaned.slice("dev:".length);
  return cleaned || null;
}
