'use strict';

var React = require('react');
var Slide = require('./Slide');

module.exports = [
  function () {
    return (
      <Slide>
        <br/>
        <div className="first-slide-logos">
          <a className="tbone-logo" href="/" target="_blank"> TBone </a>
        </div>
        <h1 className="tbone-title">
            <a href="/" target="_blank">TBone</a>
        </h1>
        <br/>
        <h3> Dataflow-oriented Programming for JavaScript </h3>
        <br/>
        <br/>
        <br/>
        <h3 className="author">
            <a href="http://tillberg.us/about" target="_blank">Dan Tillberg</a>
        </h3>
        <div className="first-slide-logos">
          <a className="appneta-logo" href="http://dev.appneta.com" target="_blank"> AppNeta </a>
          <a className="threatstack-logo" href="http://www.threatstack.com" target="_blank"> Threat Stack </a>
        </div>
        <br/>
        <h5>
            Follow along at <a href="http://tbonejs.org/preso" target="_blank">http://tbonejs.org/preso</a>
        </h5>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            What is this thing?
        </h1>
        <h3>
            TBone{"'"}s original purpose:
        </h3>
        <p className="reveal-1">
            Provide live templates on top of Backbone.
        </p>
        <p className="reveal-2">
            Because who doesn't need another live templating library?
        </p>
      </Slide>
    );
  },
];
