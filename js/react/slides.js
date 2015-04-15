'use strict';

var React = require('react');
var Slide = require('./Slide');

module.exports = [
  function () {
    return (
      <Slide>
        <br/>
        <br/>
        <a href="/" target="_blank">
            <h1 className="tbone-logo">
                TBone
            </h1>
        </a>
        <h1 className="tbone-title">
            <a href="/" target="_blank">TBone</a>
        </h1>
        <br/>
        <h3>
            Dataflow-oriented Programming for JavaScript
        </h3>
        <br/>
        <br/>
        <br/>
        <h3 className="author">
            <a href="http://tillberg.us/about" target="_blank">Dan Tillberg</a>
        </h3>
        <div className="first-slide-logos">
          <a className="appneta-logo" href="http://dev.appneta.com" target="_blank">
            AppNeta
          </a>
          <a className="threatstack-logo" href="http://www.threatstack.com" target="_blank">
            Threat Stack
          </a>
        </div>
        <br/>
        <h5>
            Follow along at <a href="http://tbonejs.org/preso" target="_blank">http://tbonejs.org/preso</a>
        </h5>
      </Slide>
    );
  },
  function () {

  },
];
