---
title: tbone.models.async
---

- tbone.models.async:
  - Extends `tbone.models.bound`.
  - Similar to bound models, but the `state` function returns data via
    an async callback.
  - Handles update generations for you, preventing older, slower updates
    from overwriting newer, faster updates.
