---
title: tbone.collections.base
---

TBone Collections are a subclass of Model.  The main difference is that the
root data item is an Array instead of an Object.  Define **model** in a
subclass to automatically create models of that type via **add**.

- `tbone.collections.base`: Base TBone Collection.
- `collection.extend`, `collection.make`, etc.: Same as for Models.
- `collection.add(modelOrData)`: Add a model to the collection.  If raw data
  is passed instead, a model (of type specified by the **model** property of
  the collection) is created automatically.
- `collection.remove(modelOrId)`: Remove a model from the collection.

To query for a model in a collection, use the pound sign (#) followed by the
ID of the model.  For example, `T('users.#42.name')`.

