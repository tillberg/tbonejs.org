var React = require('react');

var Code = React.createClass({

  render: function() {
    var { code, ...other } = this.props;
    return (
      <pre {...other}>
        {code}
      </pre>
    );
  }

});

module.exports = Code;