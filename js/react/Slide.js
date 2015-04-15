'use strict';

var React = require('react');

var Slide = React.createClass({

  render: function() {
    var {...other} = this.props;
    return (
      <div className="slide" {...other} />
    );
  }

});

module.exports = Slide;
