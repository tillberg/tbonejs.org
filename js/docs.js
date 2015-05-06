
var $ = require('jquery');

$('a[href]').each(function() {
  var $el = $(this);
  $el.toggleClass('active', $el.attr('href') === (document.location.pathname.replace(/\/$/, '') || '/'));
});
