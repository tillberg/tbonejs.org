---
title: Overview
---

TBone is a JavaScript library that enables dataflow-oriented programming.

With TBone, you set up data dependencies between the DOM, the current page state, and data from remote servers. Instead of explicitly (and repetitively) binding to data sources by hand, you just write idempotent functions and TBone takes care of binding and re-executing everything in an efficient manner.

```js
> T('name.first', 'Sally');
  T('name.last', 'Smith');
  T('name.full', function () {
    return T('name.first') + ' ' + T('name.last');
  });
...
> console.log(T('name'));
Object {full: "Sally Smith", first: "Sally", last: "Smith"}
```

TBone was written by [Dan Tillberg][5] in order to harness order out of the chaos of complex web applications at [AppNeta][1] and [Threat Stack][2]. Fork it on [Github][3].

<div class="centered-logos">
  <a class="appneta-logo" href="http://dev.appneta.com"> AppNeta </a>
  <a class="threatstack-logo" href="http://www.threatstack.com"> Threat Stack </a>
</div>

[1]: https://dev.appneta.com/
[2]: https://www.threatstack.com/
[3]: https://github.com/appneta/tbone
[5]: https://www.tillberg.us/about
