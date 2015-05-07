---
title: Base Model
---

- `tbone.models.base`:
  - Set data to it via `.query(prop, value)`.
  - Read and bind to data via `.query(prop)`.
  - Supports deep-lookups and deep-binding, e.g. `.query('users.2.name.first')`.
  - Supports Object, Array, Number, String, Date, null, and undefined.

- `model.extend(prototypeProperties)`: Creates your very own TBone Model prototype.
- `model.make(instanceProperties)`: Make a new model instance.


- `model.queryModel(prop)`: Look up **prop** and return the the model found there
  instead of extracting its data.
- `model.toggle(prop)`: sets **prop** to !**prop**, i.e. alternate between
  true and false.
- `model.push(prop, value)`: Add **value** at the end of the list at **prop**.
- `model.unshift(prop, value)`: Insert **value** at beginning of the list at
  **prop**.
- `model.removeFirst(prop)`: Remove the first item from the list at **prop**,
  like `shift` except that you don't get the value back.
- `model.removeLast(prop)`: Remove the last item from the list at **prop**,
  like `pop` except that you don't get the value back.
- `model.unset(prop)`: Delete the specified property.  Practically equivalent
  to using `model.query(prop, undefined)`.
- `model.increment(prop, number)`: Adds **number** to **prop**.  Use a negative
  number to subtract.
