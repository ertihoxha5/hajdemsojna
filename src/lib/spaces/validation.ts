import { z } from "zod";
import { AMBIENCES, ENVIRONMENTS } from "./environments";

/**
 * Every value that crosses into a study space.
 *
 * The environment and ambience keys are checked against the real lists rather
 * than accepted as free strings, so a forged body cannot put a room into a
 * state the map does not know how to draw.
 */

const environmentKey = z.enum(
  ENVIRONMENTS.map((e) => e.key) as [string, ...string[]]
);
const ambienceKey = z.enum(AMBIENCES.map((a) => a.key) as [string, ...string[]]);

export const spacePrivacy = z.enum(["public", "private", "friends"]);

export const createSpaceInput = z.object({
  name: z.string().trim().min(2, "Emri është shumë i shkurtër").max(60),
  about: z.string().trim().max(300).default(""),
  subjectId: z.string().min(1).nullable().default(null),
  privacy: spacePrivacy.default("private"),
  environment: environmentKey,
  ambient: ambienceKey.default("none"),
  syncAmbient: z.boolean().default(false),
  studyMinutes: z.number().int().min(5).max(180),
  breakMinutes: z.number().int().min(0).max(60),
  roundCount: z.number().int().min(1).max(12),
  maxMembers: z.number().int().min(2).max(24).default(8),
  aiSupervisor: z.boolean().default(true),
  rules: z.string().trim().max(600).default(""),
});

export const joinByCodeInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    // Codes are read aloud and retyped, so spacing and dashes are forgiven.
    .transform((c) => c.replace(/[\s-]/g, ""))
    .pipe(z.string().length(6, "Kodi ka 6 karaktere")),
});

export const moveInput = z.object({
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(63),
  seatId: z.string().max(40).nullable().default(null),
});

export const heartbeatInput = z.object({
  activity: z.enum(["active", "idle", "away", "disconnected"]),
  /** True when the browser saw a real keypress or pointer move since last time. */
  interacted: z.boolean().default(false),
});

export const studyStatusInput = z.object({
  studySubject: z.string().trim().max(80).default(""),
  studyTopic: z.string().trim().max(120).default(""),
  studyGoal: z.string().trim().max(200).default(""),
  goalDone: z.boolean().default(false),
});

export const sessionCommandInput = z.object({
  action: z.enum(["start", "pause", "resume", "skip", "end"]),
});

export const spaceSettingsInput = z.object({
  privacy: spacePrivacy.optional(),
  ambient: ambienceKey.optional(),
  syncAmbient: z.boolean().optional(),
  locked: z.boolean().optional(),
  rules: z.string().trim().max(600).optional(),
  aiSupervisor: z.boolean().optional(),
  studyMinutes: z.number().int().min(5).max(180).optional(),
  breakMinutes: z.number().int().min(0).max(60).optional(),
  roundCount: z.number().int().min(1).max(12).optional(),
});

export const memberCommandInput = z.object({
  userId: z.string().min(1),
  action: z.enum(["promote", "demote", "kick"]),
});

export const roomMessageInput = z.object({
  text: z.string().trim().min(1, "Mesazhi është bosh").max(1000),
  replyToId: z.string().min(1).nullable().default(null),
});

export const reactionInput = z.object({
  emoji: z.enum(["👍", "👏", "☕", "🧠", "🎉"]),
});

export const avatarInput = z.object({
  body: z.number().int().min(0).max(20),
  skin: z.number().int().min(0).max(20),
  hair: z.number().int().min(0).max(20),
  hairColor: z.number().int().min(0).max(20),
  shirt: z.number().int().min(0).max(20),
  trousers: z.number().int().min(0).max(20),
  shoes: z.number().int().min(0).max(20),
  accessory: z.number().int().min(0).max(20),
  backpack: z.number().int().min(0).max(20),
});

/** WebRTC signalling is not implemented; this reserves the shape. */
export const signalInput = z.object({
  to: z.string().min(1),
  payload: z.unknown(),
});
