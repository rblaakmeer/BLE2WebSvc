# Implementation Plan: Bounded TTL/LRU discovery registry

## Selected Design And Constraints

Selected Option 1 from `proposals/bounded-ble-discovery.md`, bound to scan
revision `4d2a211409bb25b42c09249d6543bae8eac194d3`.

## Affected Components

`ble-manager.js` and BLE manager tests.

## Ordered Work Packages

1. Track last-seen time for discovered peripherals.
2. Expire disconnected entries and evict the least-recently-seen entry at the cap.
3. Preserve connected peripheral state and existing formatted API results.
4. Add expiry and identifier-churn regression coverage.

## Tests And Security Validation

Verify stale-entry expiry, a hard upper bound under unique advertisements, and
ordinary discovery/connection flows.

## Rollout And Rollback

Start with the documented 256-entry, 15-minute defaults; tune with real device
counts. Roll back by increasing the limits temporarily, not by removing them.
