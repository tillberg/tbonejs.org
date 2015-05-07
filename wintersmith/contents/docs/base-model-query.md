---
title: models.base.query
---

### get: `T(prop)`

Gets **prop** and bind current T-function to changes in it.

- **prop**: String.  e.g. 'name' or 'person.name.first'

### set value: `T(prop, value)`

Sets **prop** to **value**.

- **prop**: String.  e.g. 'name' or 'person.name.first'.
- **value**: any serializable object (String, Number, Array, Object, Date),
  or a TBone/Backbone model/collection.
