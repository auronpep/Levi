# Phase 6: `josh` cryptographic audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Spec §9 — every verdict and significant state transition becomes tamper-evident via a layered HMAC-chain (we build) + Ed25519 signature (per-agent identity). End state: a 50-event audit chain verifies; a single-byte tamper breaks at the exact line; a forgery test (valid HMAC, wrong sig key) is rejected; a delegation chain (parent agent → ephemeral sub-agent) verifies.

**Architecture:** Six small lib modules built on Node's built-in `crypto`. No new deps. Keys live at file paths with `0o600` permissions; Phase 6.5 may add OS-keychain wrap. CLI surface: `josh agent mint`, `josh audit verify`, `josh audit rotate-key`, `josh verdict verify`. Phase 4 verdict-envelope writer signs the payload before writing.

**Tech Stack:** Node ≥18 `crypto` (HMAC-SHA256, Ed25519 generate/sign/verify, sha256 hash), `Buffer.from(b64url)`, no new deps.

**Source spec:** §9.1 (HMAC chain), §9.2 (Ed25519 + DID + JWS-compact), §9.3 (delegation), §9.4 (read-time verification).

**Phase 6.5 (deferred):** OS-keychain wrap (Windows DPAPI) for key files; key-rotation cron.

---

## File structure

| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/canonical-json.js` | Stable-key-sort serializer (no whitespace) | New |
| `bin/josh/lib/identity.js` | Per-agent Ed25519 keypair, DID, brief_hash | New |
| `bin/josh/lib/jws.js` | JWS-compact encode/verify (alg=EdDSA) | New |
| `bin/josh/lib/audit-key.js` | Mint / load / rotate audit HMAC keys | New |
| `bin/josh/lib/audit-chain.js` | `appendChainedAudit`, `verifyChain` | New |
| `bin/josh/lib/delegation.js` | Parent-signed VC for sub-agent verdicts | New |
| `bin/josh/lib/verdict-envelope.js` | Add signature embed + verify | Modify (Phase 4 module) |
| `bin/josh/josh.js` | CLI: `agent mint`, `audit verify`, `audit rotate-key`, `verdict verify` | Modify |
| Tests | One per lib + crypto-smoke end-to-end | New |
| Docs | README "Crypto audit (Phase 6)" + USER-MANUAL §7.19 | Modify |

Each lib stays under ~150 LOC.

## Algorithm freeze

- **Canonical JSON v1**: recursive sort by key, no whitespace, no number normalization, UTF-8 string output. Locked at v1 for the chain.
- **HMAC chain**: `hmac_i = HMAC_SHA256(audit_key, prev_hmac_bytes || canonical_json_bytes(event_minus_hmac))`. Genesis: `prev_hmac = 32 zero bytes`. `audit_key` is raw 32 bytes at `~/.josh/keys/audit-<key_id>.key` (0o600).
- **Ed25519**: raw 32-byte seed at `~/.josh/agents/<id>/identity.key` (0o600). Public stored as JWK at `pubkey.jwk`. DID = `did:key:z<base64url(pubkey_32B)>`.
- **JWS-compact**: header = `{"alg":"EdDSA","kid":"<did>"}`. signing_input = `${b64url(header)}.${b64url(payload)}`. Signature = `crypto.sign(null, Buffer.from(signing_input), privKey)`. Output = `${signing_input}.${b64url(sig)}`.
- **Verdict envelope**: `payload` body must include `aud:"josh:audit"`, `iat`, `nbf`, `brief_hash`. Sig stored at top-level `sig` (full JWS-compact string).
- **Brief hash**: `sha256(file_bytes_of_source_brief)` hex.

## Tasks

1. `canonical-json.js` + tests
2. `identity.js` (mint, load, derive DID, brief_hash) + tests
3. `jws.js` (encode/verify EdDSA) + tests
4. `audit-key.js` (mint/load/rotate) + tests
5. `audit-chain.js` (append/verify) + tests
6. `delegation.js` (issue/verify VC) + tests
7. Wire signing into `verdict-envelope.js` (Phase 4) + verifier
8. CLI: `josh agent mint`, `josh audit verify <date>`, `josh audit rotate-key`, `josh verdict verify <todo-id> <agent-id>`
9. End-to-end `crypto-smoke.test.js`: 50 events, verify, tamper, rotate-mid-day, forgery, delegation
10. Docs

Each task: TDD → implement → tests pass → commit.
