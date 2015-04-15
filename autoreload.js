'use strict';
(function () {
  var isFirstConnection = true;
  function listen() {
    var ws = new WebSocket('ws://' + document.location.host + '/ws_autoreload');
    ws.onopen = function() {
      if (!isFirstConnection) {
        console.log('reloading due to server restart...');
        setTimeout(location.reload, 1000);
        return;
      }
      isFirstConnection = false;
    };
    ws.onmessage = function(ev) {
      var type = ev.data;
      console.log('type ' + type);
      if (type === 'html' || type === 'all' || type === 'js') {
        location.reload();
      } else if (type === 'css') {
        var links = document.querySelectorAll('link');
        for (var i = 0; i < links.length; i++) {
          var href = links[i].getAttribute('href');
          var parts = href.split('?');
          var version = (parseFloat(parts[1]) || 0) + 1;
          links[i].setAttribute('href', parts[0] + '?' + version);
        }
      }
    };
    ws.onclose = function(ev) {
      setTimeout(listen, 1000);
    };
  }
  if (document.location.hostname === 'localhost') {
    listen();
  }
}());
