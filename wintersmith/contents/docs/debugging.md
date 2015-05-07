---
title: Debugging
---

- `TBONE_DEBUG`: Set to true just before loading TBone in order to enable
  debug output & features (not available using Production minified source).
- `tbone.freeze()`: Freeze the page; no further TBone updates will occur.
- `tbone.watchLog(query)`: Output log information to the console for **query**.
  Interesting things to try: 'scheduler', 'exec', 'lookups', or the name of
  View/Model/Collection.
