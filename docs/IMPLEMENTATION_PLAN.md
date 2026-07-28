# Implementation Plan (Popularity Focus)

## Product strategy

- Core promise: fastest way to extract QR values from real web pages.
- Initial differentiator: Sweep Page mode + local history + quick actions.

## Feature priorities

1. Sweep Page mode (done in this starter project)
2. Stronger recognition pipeline (resize, contrast, multi-pass)
3. Better retention features (favorites, folders, recall)
4. Viral loop (share clean result links, keyboard-first UX)

## Metrics to track

- Time to first success
- Scan success rate per source (image/camera/page)
- Daily active users
- 7-day retention
- Store rating conversion

## Engineering notes

- Keep decoding local for privacy and speed.
- Keep panel interactive under 100 ms for control actions.
- Batch tasks should fail soft and continue to next candidate.
