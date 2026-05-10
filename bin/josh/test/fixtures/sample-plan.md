---
id: 01HXPLAN00000000000000001
status: PENDING
claimed_by: A01
plan_hash: abc123
---

## Fast-Path

This plan locks the four-day launch definition.

## Problem statement

The launch definition is currently fluid.

## Current state evidence

PROGRESS_TRACKER.md shows the launch in scope-lock day 1.

## Proposed approach

Freeze the definition by writing a one-page brief and committing it.

## Step-by-step change list

1. Draft the brief.
2. Review with command center.
3. Commit.

## Risks + rollback

Risk: scope grows mid-week. Rollback: revert the commit and re-run scope.

## Test plan

Run `josh project status` and confirm Day 1 phase 1 shows the new brief.

## Approval prompt

Reply APPROVE: 01HXPLAN00000000000000001 or REVISE: <reason>
