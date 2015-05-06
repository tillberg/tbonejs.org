'use strict';

require('./docs');

window._ = require('lodash');
window.$ = require('jquery');
require('./3rdparty/highlight');

var tbone = require('tillberg-tbone');
var React = require('react');
tbone.patchReact(React);

require('./preso');
require('./iframe_demo');
require('./autoreload');
