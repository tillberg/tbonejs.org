---
title: Setup
---

## Requirements

* Underscore.js or Lodash. (TODO: Add minimum versions)

## Download

* [Development version, with comments](//cdn.tbonejs.org/tbone-2.0.0.js) **54kb**
* [Production version, minified](//cdn.tbonejs.org/tbone-2.0.0.min.js) **4.3kb gzipped**

```html
Development: <script src="https://cdn.tbonejs.org/tbone-2.0.0.js"></script>
Production: <script src="https://cdn.tbonejs.org/tbone-2.0.0.min.js"></script>
```

## NPM

```sh
npm install tillberg-tbone
```

And in node or browserify:
```js
var tbone = require('tillberg-tbone');
var hello;
tbone(function() {
  console.log(tbone('hello'));
});
tbone('hello', 'world');
// Outputs `undefined` and then `world`.
```
