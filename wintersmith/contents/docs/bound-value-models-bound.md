---
title: tbone.models.bound
---

- `tbone.models.bound`:
  - Extends `tbone.models.base`.
  - Instead of setting data via `query`, the data held is bound to the
    return value of a `state` function.
  - This `state` function can query values from other models as part of
    its calculation; whenever those other models are update, the `state`
    function is automatically re-run in order to recalculate.

- `model.state`: Override this with a function to generate this model's data.
  This has similar utility to `T(prop, fn)`.

- `tbone.hasViewListener(model)`: Returns true if a View is listening
  either directly or indirectly (i.e. through other model dependencies) for
  changes to **model**.  This is used internally by TBone to prevent loading
  ajax data for any models that are not needed as part of the UI currently.



### set function: `T(prop, fn)`

Binds **prop** to the live result of **fn**

- **prop**: String.  e.g. 'name' or 'person.name.first'.
- **fn**: Function.  The return value of this function will be set to **prop**.
  This function gets re-run any time its dependencies change.
