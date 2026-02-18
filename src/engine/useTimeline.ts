// src/engine/useTimeline.ts — Frame-based animation state machine
//
// Resolves a declarative Timeline into per-frame animation state for
// every node, connection, and container. Driven by useCurrentFrame().
//
// Timeline phases play sequentially:
//   hold    — pause at current state
//   dim     — ramp all elements from full → dim (bookend transition)
//   sequence — per-element animation steps (the walkthrough)
//   reveal  — ramp all elements from dim → full (bookend transition)
//
// Animation lifecycle:
//   [full → dim] → per-element envelopes → [reveal → full]
//
// The global floor (from dim/reveal phases) acts as a brightness minimum.
// During bookend holds, everything is fully lit. During the sequence,
// individual event envelopes control highlighting.

import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type {
  AnimationStep,
  ConnectionDef,
  ContainerDef,
  ElementAnimState,
  NodeDef,
  Timeline,
  TimelineState,
} from "../types";
import { getConnectionId } from "../types";

// ─── Timing defaults (seconds) ──────────────────────────────────

const DEFAULT_FILL_DURATION = 0.8; // box border draw + highlight
const DEFAULT_DRAW_DURATION = 0.4; // arrow stroke draw
const DEFAULT_SHOW_DURATION = 0.4; // container reveal
// Fade-out lookahead: how many steps ahead triggers this element's fade-out.
// Arrows use 2, nodes/containers use 3. This way a source node (beat N, lookahead 3)
// and its outgoing arrow (beat N+1, lookahead 2) both trigger fade-out at N+3.
const FADE_OUT_LOOKAHEAD_NODE = 3;
const FADE_OUT_LOOKAHEAD_ARROW = 2;
const FADE_OUT_S = 0.4;

// Dim levels
const DIM_NODE = 0.3;
const DIM_ARROW = 0.15;
const DIM_CONTAINER = 0.3;

// ─── Flattened Event ────────────────────────────────────────────

type FlatEvent = {
  action:
    | "fillBox"
    | "dimBox"
    | "drawLine"
    | "showContainer"
    | "hold"
    | "dim"
    | "reveal";
  source: "phase" | "step"; // 'phase' = top-level timeline phase, 'step' = inside a sequence
  target?: string;
  startFrame: number;
  durationFrames: number;
  step?: { num: number; text: string };
  group?: string;
};

// ─── Hook ───────────────────────────────────────────────────────

export function useTimeline(
  timeline: Timeline,
  nodes: NodeDef[],
  connections: ConnectionDef[],
  containers: ContainerDef[],
): TimelineState | null {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (timeline.length === 0) return null;

  // Still compositions have durationInFrames=1 and fps=1.
  // Timeline animation doesn't apply — return null for static rendering.
  if (fps <= 1) return null;

  // ── Flatten timeline into events ──
  const events = flattenTimeline(timeline, fps);
  const totalFrames =
    events.length > 0
      ? Math.max(...events.map((e) => e.startFrame + e.durationFrames))
      : 0;

  // ── Compute global floor + global opacity from dim/reveal phases ──
  const { globalFloor, globalOpacity } = computeGlobals(events, frame);

  // Only count steps from actual animation events (not dim/reveal/hold)
  const animEvents = events.filter(
    (e) => e.action !== "hold" && e.action !== "dim" && e.action !== "reveal",
  );
  const totalSteps = animEvents.filter((e) => e.step != null).length;

  // ── Generate connection IDs (matching useGridLayout's convention) ──
  const connIds = connections.map((c) => getConnectionId(c));

  // ── Compute per-element animation ──

  const nodeStates: Record<string, ElementAnimState> = {};
  const connStates: Record<string, ElementAnimState> = {};
  const containerStates: Record<string, ElementAnimState> = {};

  // ── Pre-compute group fade-out triggers ──
  // For lifecycle groups: all events in the same group share the latest
  // (most generous) fade-out trigger so they fade out together.
  const groupLatestTriggerFrame: Record<string, number> = {};

  const computeFadeOutStart = (
    evtIndex: number,
    evt: FlatEvent,
  ): number | null => {
    const lookahead =
      evt.action === "drawLine"
        ? FADE_OUT_LOOKAHEAD_ARROW
        : FADE_OUT_LOOKAHEAD_NODE;
    const triggerIdx = evtIndex + lookahead;
    if (triggerIdx >= animEvents.length) return null; // near end — stay lit
    return (
      animEvents[triggerIdx].startFrame + animEvents[triggerIdx].durationFrames
    );
  };

  // First pass: find the latest fade-out start per group
  for (let i = 0; i < animEvents.length; i++) {
    const evt = animEvents[i];
    if (!evt.group) continue;
    const fadeOutStart = computeFadeOutStart(i, evt);
    if (fadeOutStart === null) {
      groupLatestTriggerFrame[evt.group] = Infinity;
    } else {
      groupLatestTriggerFrame[evt.group] = Math.max(
        groupLatestTriggerFrame[evt.group] ?? 0,
        fadeOutStart,
      );
    }
  }

  // Helper: compute envelope for an event at current frame
  const eventEnvelope = (evt: FlatEvent, evtIndex: number): number => {
    const onset = evt.startFrame;
    const fadeInEnd = onset + evt.durationFrames;

    // Determine fade-out start: grouped → use group's shared trigger, else per-event
    let fadeOutStart: number | null;
    if (evt.group && groupLatestTriggerFrame[evt.group] !== undefined) {
      const groupTrigger = groupLatestTriggerFrame[evt.group];
      fadeOutStart = groupTrigger === Infinity ? null : groupTrigger;
    } else {
      fadeOutStart = computeFadeOutStart(evtIndex, evt);
    }

    if (fadeOutStart === null) {
      // Near end — stay lit
      return interpolate(frame, [onset, fadeInEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }

    const fadeOutFrames = Math.round(FADE_OUT_S * fps);
    let adjustedFadeOutStart = fadeOutStart;
    let fadeOutEnd = adjustedFadeOutStart + fadeOutFrames;

    // Guard: inputRange must be strictly monotonically increasing.
    if (adjustedFadeOutStart <= fadeInEnd) {
      adjustedFadeOutStart = fadeInEnd + 1;
      fadeOutEnd = adjustedFadeOutStart + fadeOutFrames;
    }

    return interpolate(
      frame,
      [onset, fadeInEnd, adjustedFadeOutStart, fadeOutEnd],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  };

  // Draw progress: ramps 0→1 over duration, never retracts
  const eventDrawProgress = (evt: FlatEvent): number => {
    return interpolate(
      frame,
      [evt.startFrame, evt.startFrame + evt.durationFrames],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
  };

  // Process events for nodes
  for (const ndef of nodes) {
    let maxBright = 0;
    let maxDraw = 0;
    let dimAmount = 0; // tracks dimBox contribution (smooth 0→1 ramp)
    for (let i = 0; i < animEvents.length; i++) {
      const evt = animEvents[i];
      if (evt.action === "fillBox" && evt.target === ndef.id) {
        maxBright = Math.max(maxBright, eventEnvelope(evt, i));
        maxDraw = Math.max(maxDraw, eventDrawProgress(evt));
      }
      if (evt.action === "dimBox" && evt.target === ndef.id) {
        // dimBox progress ramps 0→1, reducing brightness by that amount
        dimAmount = Math.max(dimAmount, eventDrawProgress(evt));
      }
    }
    // Global floor lifts brightness during bookend phases
    const brightness = Math.max(
      Math.max(maxBright, globalFloor) - dimAmount,
      0,
    );
    // Draw progress: fully drawn during bookend (globalFloor > 0), per-event during sweep
    const drawProgress = Math.max(maxDraw, globalFloor);
    nodeStates[ndef.id] = {
      brightness,
      drawProgress,
      opacity: DIM_NODE + (1 - DIM_NODE) * brightness,
    };
  }

  // Process events for connections
  // Find the end of the flow (last non-hold/dim/reveal event end)
  const lastFlowEvent = [...animEvents]
    .reverse()
    .find((e) => e.action !== "hold");
  const flowEnd = lastFlowEvent
    ? lastFlowEvent.startFrame +
      lastFlowEvent.durationFrames +
      Math.round(2 * fps)
    : totalFrames;

  for (let ci = 0; ci < connections.length; ci++) {
    const connId = connIds[ci];
    let maxBright = 0;
    let maxDraw = 0;
    for (let i = 0; i < animEvents.length; i++) {
      const evt = animEvents[i];
      if (evt.action === "drawLine" && evt.target === connId) {
        maxBright = Math.max(maxBright, eventEnvelope(evt, i));
        maxDraw = Math.max(maxDraw, eventDrawProgress(evt));
      }
    }
    // Final arrow ramp: after flow ends, all arrows settle to full accent
    const fadeInFrames = Math.round(DEFAULT_DRAW_DURATION * fps);
    const finalRamp = interpolate(
      frame,
      [flowEnd - fadeInFrames, flowEnd],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    // Global floor lifts arrows during bookend phases
    const brightness = Math.max(maxBright, finalRamp, globalFloor);
    // Arrow draw: fully drawn during bookend (globalFloor), per-event during sweep,
    // and finalRamp catches any undrawn arrows at the end of the sequence
    const drawProgress = Math.max(maxDraw, globalFloor, finalRamp);
    connStates[connId] = {
      brightness,
      drawProgress,
      opacity: DIM_ARROW + (1 - DIM_ARROW) * brightness,
    };
  }

  // Process events for containers
  for (const cdef of containers) {
    let maxBright = 0;
    for (let i = 0; i < animEvents.length; i++) {
      const evt = animEvents[i];
      if (evt.action === "showContainer" && evt.target === cdef.id) {
        maxBright = Math.max(maxBright, eventEnvelope(evt, i));
      }
    }
    // Container also lights up when any inner node is lit
    for (const ndef of nodes) {
      if (ndef.container === cdef.id && nodeStates[ndef.id]) {
        maxBright = Math.max(maxBright, nodeStates[ndef.id].brightness);
      }
    }
    // Global floor lifts container during bookend phases
    const brightness = Math.max(maxBright, globalFloor);
    containerStates[cdef.id] = {
      brightness,
      drawProgress: 1,
      opacity: DIM_CONTAINER + (1 - DIM_CONTAINER) * brightness,
    };
  }

  // ── Step indicator ──
  // Only show during the sequence (not during bookend holds/dim/reveal)
  let currentStep: { num: number; text: string; progress: number } | undefined;
  for (let i = animEvents.length - 1; i >= 0; i--) {
    const evt = animEvents[i];
    if (evt.step && frame >= evt.startFrame) {
      const progress = interpolate(
        frame,
        [evt.startFrame, evt.startFrame + evt.durationFrames],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      currentStep = { num: evt.step.num, text: evt.step.text, progress };
      break;
    }
  }

  // Indicator hidden during bookend phases (globalFloor > 0 means bookend active).
  // During the sequence, indicator fades out as flow ends.
  const fadeOutFrames = Math.round(FADE_OUT_S * fps);
  const sequenceIndicatorOpacity =
    frame >= flowEnd
      ? 0
      : interpolate(frame, [flowEnd - fadeOutFrames * 2, flowEnd], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  // Suppress indicator when global floor is active (bookend phases)
  const indicatorOpacity = globalFloor > 0.01 ? 0 : sequenceIndicatorOpacity;

  return {
    nodes: nodeStates,
    connections: connStates,
    containers: containerStates,
    currentStep: indicatorOpacity > 0.01 ? currentStep : undefined,
    totalSteps,
    indicatorOpacity,
    globalOpacity,
    globalFloor,
  };
}

// ─── Global Floor + Global Opacity ──────────────────────────────

function computeGlobals(
  events: FlatEvent[],
  frame: number,
): { globalFloor: number; globalOpacity: number } {
  let floor = 1.0;
  let opacity = 1.0;

  const dimEvt = events.find((e) => e.action === "dim");
  const revealEvt = events.find((e) => e.action === "reveal");

  if (dimEvt) {
    // Dim phase present: use global opacity fade
    const dimStart = dimEvt.startFrame;
    const dimEnd = dimStart + dimEvt.durationFrames;

    // Find the first event after the dim phase
    const firstPostDimEvt = events.find(
      (e) => e.startFrame >= dimEnd && e.action !== "dim",
    );

    if (frame >= dimEnd) {
      floor = 0.0;
      opacity = 0.0;
    } else if (frame >= dimStart) {
      floor = 1.0;
      opacity = interpolate(frame, [dimStart, dimEnd], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }

    // Once the post-dim content starts, snap opacity back to 1
    if (firstPostDimEvt && frame >= firstPostDimEvt.startFrame) {
      opacity = 1.0;
    }
  } else {
    // No dim phase: hard cut from fully lit to dimmed at the sequence start.
    let sequenceStart = 0;
    for (const evt of events) {
      if (
        evt.source === "phase" &&
        (evt.action === "hold" ||
          evt.action === "dim" ||
          evt.action === "reveal")
      ) {
        sequenceStart = Math.max(
          sequenceStart,
          evt.startFrame + evt.durationFrames,
        );
      } else {
        break; // first non-phase event found — sequence content starts here
      }
    }
    if (frame >= sequenceStart) {
      floor = 0.0;
    }
    // opacity stays 1.0 — no container fade needed
  }

  if (revealEvt) {
    const revealStart = revealEvt.startFrame;
    const revealEnd = revealStart + revealEvt.durationFrames;

    if (frame >= revealEnd) {
      floor = 1.0;
    } else if (frame >= revealStart) {
      floor = Math.max(
        floor,
        interpolate(frame, [revealStart, revealEnd], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
    }
  }

  return { globalFloor: floor, globalOpacity: opacity };
}

// ─── Flatten Timeline ───────────────────────────────────────────
// Converts nested Phase[] into a flat list of timed events.

function flattenTimeline(timeline: Timeline, fps: number): FlatEvent[] {
  const events: FlatEvent[] = [];
  let cursor = 0; // current frame position

  const flattenStep = (step: AnimationStep, parentGroup?: string) => {
    if (step.action === "hold") {
      const durationFrames = Math.round(step.duration * fps);
      events.push({
        action: "hold",
        source: "step",
        startFrame: cursor,
        durationFrames,
      });
      cursor += durationFrames;
    } else if (step.action === "parallel") {
      // All children start at the same frame. Cursor advances by the longest child.
      const parallelStart = cursor;
      const group = step.group ?? parentGroup;
      let maxDuration = 0;
      for (const child of step.steps) {
        cursor = parallelStart; // reset cursor for each child
        flattenStep(child, group);
        maxDuration = Math.max(maxDuration, cursor - parallelStart);
      }
      cursor = parallelStart + maxDuration;
    } else {
      const duration = step.duration ?? getDefaultDuration(step.action);
      const durationFrames = Math.round(duration * fps);
      const group = step.group ?? parentGroup;
      events.push({
        action: step.action,
        source: "step",
        target: step.target,
        startFrame: cursor,
        durationFrames,
        step: step.step,
        group,
      });
      cursor += durationFrames;
    }
  };

  for (const phase of timeline) {
    if (phase.type === "hold") {
      const durationFrames = Math.round(phase.duration * fps);
      events.push({
        action: "hold",
        source: "phase",
        startFrame: cursor,
        durationFrames,
      });
      cursor += durationFrames;
    } else if (phase.type === "dim") {
      const durationFrames = Math.round(phase.duration * fps);
      events.push({
        action: "dim",
        source: "phase",
        startFrame: cursor,
        durationFrames,
      });
      cursor += durationFrames;
    } else if (phase.type === "reveal") {
      const durationFrames = Math.round(phase.duration * fps);
      events.push({
        action: "reveal",
        source: "phase",
        startFrame: cursor,
        durationFrames,
      });
      cursor += durationFrames;
    } else if (phase.type === "sequence") {
      for (const step of phase.steps) {
        flattenStep(step);
      }
    }
  }

  return events;
}

function getDefaultDuration(action: string): number {
  switch (action) {
    case "fillBox":
      return DEFAULT_FILL_DURATION;
    case "dimBox":
      return DEFAULT_FILL_DURATION;
    case "drawLine":
      return DEFAULT_DRAW_DURATION;
    case "showContainer":
      return DEFAULT_SHOW_DURATION;
    default:
      return DEFAULT_DRAW_DURATION;
  }
}

// ─── Total Duration Calculator ──────────────────────────────────
// Exported so compositions can compute durationInFrames for registration.

export function calculateTotalDuration(
  timeline: Timeline,
  fps: number,
): number {
  const events = flattenTimeline(timeline, fps);
  if (events.length === 0) return 0;
  return Math.max(...events.map((e) => e.startFrame + e.durationFrames));
}
