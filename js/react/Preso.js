'use strict';

var _ = require('lodash');
var React = require('react');

var slides = require('./slides');

var Preso = React.createClass({

  render: function() {
    var slidesHtml = _.map(slides, function(slideFn, i) {
      return <div key={i}>{slideFn()}</div>;
    });
    return (
      <div>
        {slidesHtml}
      </div>
    );
  }

});

module.exports = Preso;
