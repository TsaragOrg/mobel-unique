# CR-SPEC-0015 Public Simulation Visual Angle Guidance

Status: Accepted
Target Spec: SPEC-0015
Implementation Plan: PLAN-0091
Owner area: web

## Summary

Screen 1 of the public simulation wizard must explain the required room-photo
angle visually, not only through instructional text.

## Motivation

The selected sofa render already carries the desired point of view, but a
visitor can miss a plain text instruction and upload a room photo taken from a
different angle. That mismatch can make the in-home simulation harder to align
or unusable. The guidance needs to be visible at the exact moment the visitor
chooses or captures the room photo, without adding a separate tutorial step.

## Decision

Add lightweight visual angle guidance to the existing Screen 1 comparison
layout:

- Show a badge on the selected sofa frame that names the view to reproduce.
- Replace the empty room-photo upload icon with an optimized visual guide: an
  empty room image plus a transparent sofa overlay that animates into the
  placement area and then resets.
- Keep the interaction as one upload target with concise surrounding copy.

## Scope Impact

This change is frontend-only. It does not change simulation APIs, database
schema, storage behavior, worker behavior, access tokens, rate limits, or
retention rules.

## Acceptance Criteria

- The upload screen shows the selected sofa view as the angle to reproduce.
- The empty room-photo target contains a clear animated placement guide before
  a file is chosen.
- The visual assets do not contain embedded words, so localization and
  accessibility remain in HTML copy.
- The same-angle message remains available through concise HTML copy and
  accessible image text.
- The visual guide uses only the correct example, does not show a bad example,
  and does not add an extra step or hidden help surface.
- The upload target visibly includes an upload/photo call-to-action.
