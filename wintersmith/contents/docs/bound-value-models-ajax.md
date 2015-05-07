---
title: tbone.models.ajax
---

- `tbone.models.ajax`:
  - Extends `tbone.models.async`.
  - A special case of async model where the `state` function calls
    `.url()` to build a URL to GET. The `url` function can `query` other
    models to build the URL, enabling ajax models to respond to state
    transitions by fetching new data.

- `model.url`: Override this to set either a URL or function that returns
  a URL to fetch data via XHR.  If a function, you can use T-references to
  make this model re-fetch data on a property change (e.g. applying a filter).


- `tbone.isReady()`: There are no pending Model/View updates, including ajax
  models that are waiting for XHRs to finish.  This is helpful for automated
  testing to determine that the page has "settled".
