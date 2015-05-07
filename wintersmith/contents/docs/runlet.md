---
title: tbone.runlet
---

- `tbone.autorun`:
  - Creates a `FunctionRunner` that wraps a function, executes it,
    attaches bindings to all models `query`ed during execution, then
    re-runs the function whenever any of those bindings fire.
  - Execution is controlled by a central Scheduler that orders functions
    by priority and executes all waiting FunctionRunners synchronously
    after a 0ms-timeout. The short delay removes the need for using
    _.defer to prevent multiple bindings from causing multiple update
    calls to the same FunctionRunner.





### run: `T(fn)`

Run **fn** now, and again anytime its dependencies change.

- **fn**: Function.  This is executed immediately.  **fn** will get re-run
  again anytime the T-references it makes change.  Thus, generally **fn**
  should be [idempotent](http://en.wikipedia.org/wiki/Idempotence#Computer_science_meaning),
  though advanced users may find other strategies useful.


