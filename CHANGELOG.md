# Changelog

## Unreleased

- Start a maintained fork of [Kargatharaakash/grok-bot-mcp](https://github.com/Kargatharaakash/grok-bot-mcp), based on upstream commit `572b95a` and package version 1.3.0.
- Use `sendPrompt` for gateway messages and `getAgentTranscriptTail` for transcript reads.
- Route server-hosted Bot messages through the account service when the gateway returns HTTP 409 with `send/agent-unavailable`. Reuse the same message ID.
- Fall back to the account service for sending, listing Bots and reading transcripts when the gateway returns HTTP 417. Decode and sort transcript entries by sequence.
- Recognize prefixed acceptance and duplicate delivery values, report refusals, and refresh expired account tokens once while retaining the message ID.
- Add offline regression tests for delivery, hibernation, refusal, token refresh and failed sends. Isolate Windows account tests from the real user profile.
- Run offline CI on Windows, macOS and Linux with Node.js 18 and 24. Point the installer and package repository metadata at this fork.

Maintainer verification on 2026-11-18 confirmed Bot listing, sending and reading the matching reply through the attached Codex MCP. Token refresh is covered by mocks. Account and desktop-version compatibility still require live verification in each environment.
