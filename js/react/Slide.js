'use strict';

var React = require('react');

var Slide = React.createClass({

  render: function() {
    var {...other} = this.props;
    var style = {
      height: T('screen.height') + 'px',
      width: T('screen.width') + 'px',
    };
    return (
      <div className="slide" style={style} {...other} />
    );
  }

});

module.exports = Slide;
