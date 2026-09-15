# Incorrect feedback label

Status: Approved UI scope, September 15, 2026.

## Goal

Remove the misleading “Call” label from incorrect Daily feedback while keeping the status and remaining-strikes message clear.

## Scope

This is a presentation-only change in `ResultDisplay`. Daily scoring, ruleset behavior, persistence, sharing, and APIs are unchanged.

## Acceptance

An incorrect at-bat renders “Incorrect” and the remaining-strikes message without a separate “Call” label. Focused rendering coverage and the repository CI suite must pass.
