# Call Batch Orchestrator (MVP1)

This document explains how the call orchestrator works, which flags control it, and how to run safe local tests.

## What is implemented now

- Manual batch launch from admin:
  - `Check all dealerships`
  - `Check dealership`
- Background queue with statuses and retries.
- Dealership-level status summary for active batch.
- Safe controls:
  - pause new dispatch
  - resume dispatch
  - finish queue (does not drop active calls)
- Local simulation mode without real phone calls (`testMode` / `CALL_BATCH_TEST_MODE`).
- Auto-daily generation logic (3 calls per dealership/day) is implemented but disabled by default.

## Current source model

The orchestrator can work from two data sources:

- `mock` (active default): targets come from internal mock dealership directory and test phones.
- `real` (future): reserved for DB/CRM-backed dealerships and phones.

Source adapter file:
- `src/voice/dealershipCallSource.ts`

## Environment flags

Use `.env` (see `.env.example`):

- `CALL_SOURCE_MODE=mock|real`
  - default: `mock`
- `AUTO_DAILY_CALLS_ENABLED=true|false`
  - default: `false`
- `AUTO_DAILY_MAX_CONCURRENCY=10`
- `AUTO_DAILY_START_INTERVAL_MS=500`
- `CALL_BATCH_TEST_MODE=true|false`
  - when `true`, all batch jobs are simulated (no real calls)
- `CALL_BATCH_STUCK_TIMEOUT_MS=360000`
  - watchdog for stuck `in_progress` jobs

## API surface

- `POST /api/admin/call-batches`
  - creates a batch
- `GET /api/admin/call-batches/:id`
  - batch + jobs preview + dealership summary
- `GET /api/admin/call-batches/:id/jobs`
  - paged jobs
- `POST /api/admin/call-batches/:id/pause`
  - pause dispatch of new jobs
- `POST /api/admin/call-batches/:id/resume`
  - resume dispatch
- `POST /api/admin/call-batches/:id/cancel`
  - cancel queue and retries only
- `GET /api/admin/super-admin/call-orchestrator-config`
  - current flags/source snapshot

## Status model

### Job statuses

- `queued`
- `dialing`
- `in_progress`
- `retry_wait`
- `completed`
- `failed`
- `cancelled`

### Dealership statuses (summary)

- `queued`
- `in_progress`
- `completed`
- `failed`
- `partial`
- `cancelled`

## Control semantics (important)

- Pause does not interrupt an active call.
- Resume starts new jobs from queue.
- Finish queue cancels queued/retry jobs only; active calls are allowed to end naturally.

## Local test playbook (safe)

1. Set:
   - `CALL_SOURCE_MODE=mock`
   - `CALL_BATCH_TEST_MODE=true`
   - `AUTO_DAILY_CALLS_ENABLED=false`
2. Start app:
   - `npm run dev`
3. Open admin -> dealerships.
4. Run `Test run (no calls)`.
5. Verify transitions:
   - queued -> in_progress -> completed/failed/retry_wait
6. Verify dealership summary updates and batch completion.

## Real-call test playbook

1. Set:
   - `CALL_BATCH_TEST_MODE=false`
   - `CALL_SOURCE_MODE=mock`
   - `VOX_TEST_TO` or `VOX_TEST_NUMBERS` configured
2. Run small batch first (1-3 targets).
3. Watch webhook completion and job transitions.
4. Increase concurrency gradually.

## Known limitation (intentional)

- `real` source mode is a placeholder until real dealership entities (phones + work windows) are wired.
- Auto-daily should stay disabled in shared/dev environments unless explicitly requested.
