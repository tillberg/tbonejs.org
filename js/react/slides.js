'use strict';

var React = require('react');
var Slide = require('./Slide');
var Code = require('./Code');

module.exports = [
  function () {
    var code = [
      "> T('author.full', function () {",
      "    return T('author.first') + ' ' + T('author.last');",
      "  });",
      "> T('author.first', 'Dan');",
      "> T('author.last', 'Tillberg');",
      "> T('author')",
      'Object {full: "Dan Tillberg", first: "Dan", last: "Tillberg"}',
    ].join('\n');
    return (
      <Slide>
        <div className="first-slide-logos">
          <a className="tbone-logo" href="/" target="_blank"> TBone </a>
        </div>
        <h1 className="tbone-title">
            <a href="/" target="_blank">TBone</a>
        </h1>
        <h3> Dataflow-oriented Programming for JavaScript </h3>
        <br/>
        <Code style={{width:'38em'}} code={code} />
        <br/>
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
            Because who doesn{"'"}t need another live templating library?
        </p>
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
            TBone{"'"}s second purpose:
        </h3>
        <p className="reveal-1">
            Use the dependency graph of models to determine which models are actually used in the UI, and to <strong>put the others to sleep</strong>.  Out of 70 models in our app, only 10-20 typically are active on the page at any one time.
        </p>
        <p>
            <img className="reveal-2 bedtime-1" src="/preso/tbone_bedtime_stories_figure_1.png"/>
            <img className="reveal-3 bedtime-2" src="/preso/tbone_bedtime_stories_figure_2.png"/>
        </p>
        <p className="reveal-4">
            <img className="lots-of-models" src="/preso/lots_of_models_graph.png"/>
        </p>
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
            TBone{"'"}s third (and now primary) purpose:
        </h3>
        <br/>
        <blockquote className="reveal-1">A simple, general-purpose reactive programming platform as a platform for applications and as plumbing for other JS libraries.</blockquote>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Why is reactive programming so awesome?
        </h1>
        <br/>
        <p className="reveal-1">
            Conquer async.
        </p>
        <p className="reveal-2">
            No async callbacks.  Instead, just write everything <strong>idempotently</strong> and TBone will rerun functions, models, and views as necessary.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Why else is reactive programming so awesome?
        </h1>
        <p className="reveal-1">
            The hardest UI bugs often look something like:
        </p>
        <ul className="reveal-1 small">
            <li>Why the heck does that li have a class of active?</li>
            <li>Where on earth does this value get changed from 314 to "$3.14"?</li>
        </ul>
        <p className="reveal-2">
            Live templating already empowers you trace where each HTML element, attribute, and piece of text comes from in your data.
        </p>
        <p className="reveal-2">
            <strong>Reactive programming extends this to data.</strong>
        </p>
        <p className="reveal-3">
            It's similar to functional programming in this way, though with reactive programming you can see and inspect the intermediate data; it's more akin to message-passing.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Crash Preview
        </h1>
        <div tbone="tmpl example root examplesByName.Current_Time"></div>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h3>
            Add in a formatting step...
        </h3>
        <div tbone="tmpl example root examplesByName.Current_Time_Formatted"></div>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h3>
            Now with a View
        </h3>
        <div tbone="tmpl example root examplesByName.Current_Time_Formatted_View"></div>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h3>
            Or with nested Views
        </h3>
        <div tbone="tmpl example root examplesByName.Current_Time_Formatted_View_Many"></div>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Three Tenets of TBone
        </h1>
        <ul className="large">
            <li>Get: T(prop)</li>
            <li>Set: T(prop, value)</li>
            <li>Run: T(fn)</li>
        </ul>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Get: T(prop)
        </h1>
        <p>
            <pre>T('activeStep');</pre>
            <pre className="reveal-1">T('user.name.first');</pre>
            <pre className="reveal-2">T('widgets.4.price');</pre>
        </p>
        <p className="reveal-3">
            TBone evaluates each of these by splitting the string and doing a
            recursive lookup in a for loop.
        </p>
        <p className="reveal-4">
            In addition to returning the current value, TBone binds the
            currently-executing T-function (more on that in a couple slides...)
            to changes in that value.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Set: T(prop, value)
        </h1>
        <pre>T('activeStep', 5);</pre>
        <pre className="reveal-1">T('user.name.first', 'Bob');</pre>
        <pre className="reveal-2">
    T('widgets.4', {'{'}
        price: '$3.99',
        num: 5
    {'}'});
        </pre>
        <p className="reveal-3">
            These change the value and fire change events accordingly.
        </p>
        <p className="reveal-4">
            TBone does what you might expect here:
        </p>
        <pre className="reveal-4">
    T('widgets.4');     // &rarr; {'{'} price: '$3.99', num: 5 {'}'}
    T('widgets.4.num'); // &rarr; 5
    T('user.name');     // &rarr; {'{'} first: 'Bob' {'}'}
        </pre>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Run: T(fn)
        </h1>
        <pre>
    T(function () {'{'}
        var num = T('numItems');
        var mass = T('itemMass');
        $('#num').text('Quantity: ' + num);
        $('#totalMass').text('Total mass: ' + (mass * num));
    {'}'});
        </pre>
        <p className="reveal-1">
            T-functions are the binding scope for TBone.
        </p>
        <p className="reveal-2">
            Instead of binding change events to callbacks, you wrap T-references in T-functions.
        </p>
        <p className="reveal-3">
            Whenever any of the values referenced in a T-function change, the function will be run again.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Run: Nested T(fn)
        </h1>
        <pre>
    T(function () {'{'}
        var num = T('numItems');
        $('#num').text('Quantity: ' + num);
        T(function () {'{'}
            var mass = T('itemMass');
            $('#totalMass').text('Total mass: ' + (mass * num));
        {'}'});
    {'}'});
        </pre>
        <p className="reveal-1">
            T-functions can be nested.  TBone will re-run the outer scope here when 'numItems' changes, but only the inner scope when 'itemMass' changes.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Run: Nesting T(fn)
        </h1>
        <pre>
    function updateNumberOfItems (num) {'{'}
        T(function () {'{'}
            var mass = T('itemMass');
            $('#totalMass').text('Total mass: ' + (mass * num));
        {'}'});
    {'}'}
        </pre>
        <pre className="reveal-1">
    // ... and somewhere else completely different:
    T(function () {'{'}
        var num = T('numItems');
        $('#num').text('Quantity: ' + num);
        updateNumberOfItems(num);
    {'}'});
        </pre>
        <p className="reveal-2">
            T-functions are nested dynamically, not lexically.
        </p>
        <p className="reveal-3">
            This allows locally binding references without the <em>caller</em> needing to know when the <em>callee</em> should be re-executed.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h3>
            First example, revisited:
        </h3>
        <div tbone="tmpl example root examplesByName.Current_Time"></div>
        <p className="reveal-1">
            The T-function at the top runs every time T('now') changes.
        </p>
        <p className="reveal-1">
            And every 100ms, we update T('now') to a new Date object.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Live data providers
        </h1>
        <p>
            This code sets up a live data source for the current date with a precision of about 100ms:
        </p>
        <pre>
    setInterval(function () {'{'}
        T('now', new Date());
    {'}'}, 100);
        </pre>
        <p className="reveal-1">
            Anyone else can subscribe to it:
        </p>
        <pre className="reveal-1">
    T(function () {'{'} console.log(T('now') &amp;&amp; T('now').getTime()); {'}'});
    T(function () {'{'} $('title').text(T('now')); {'}'});
    T(function () {'{'} $('body').text('It is ' + T('now')); {'}'});
        </pre>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Screen dimension data provider
        </h1>
        <p>
            We can set up a data source for the current screen dimensions:
        </p>
        <pre className="reveal-1">
    function update () {'{'}
        T('screen.width', $(window).width());
        T('screen.height', $(window).height());
    {'}'}
    $(window).bind('resize', update);
    function timer () {'{'}
        update();
        setTimeout(timer, 1000);
    {'}'}
    timer();
    </pre>
        <p className="reveal-2">
            This updates both whenever the window resize event triggers, and also every second.
        </p>
        <p className="reveal-3">
            We use this in our app to make some Views "responsive."  Just add a reference to T('screen') and the View will re-render when the browser is resized.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Set w/fn: T(prop, fn)
        </h1>
        <p>
            TBone models don{"'"}t store functions as values.  If you set a TBone property to a function, instead that property will be <strong>live-bound</strong> to the return value of the function.
        </p>
        <pre className="reveal-1">
    T('screen.totalPixels', function () {'{'}
        return T('screen.width') * T('screen.height');
    {'}'});

    T('formattedNow', function () {'{'}
        var now = T('now');
        return now ? (_.pad(now.getHours(), 2, '0') + ':' +
                      _.pad(now.getMinutes(), 2, '0') + ':' +
                      _.pad(now.getSeconds(), 2, '0')) : '';
    {'}'});
        </pre>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Set w/model: T(prop, model)
        </h1>
        <p>
            These are equivalent:
        </p>
        <pre className="reveal-1">
    T('screen.totalPixels', function () {'{'}
        return T('screen.width') * T('screen.height');
    {'}'});

    T('screen.totalPixels', tbone.models.bound.make({'{'}
        state: function () {'{'}
            return T('screen.width') * T('screen.height');
        {'}'}
    {'}'}));
        </pre>
        <p className="reveal-2">
            Setting to a function creates a 'bound' TBone model on the fly and assigns that model to the property.
        </p>
        <p className="reveal-3">
            When you get a property, e.g. T('screen.totalPixels'), TBone will recurse into the child model and return its value instead of returning the model itself.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            T is a Model
        </h1>
        <p>
            And you can make more of them!
        </p>
        <pre className="reveal-1">
    var myModel = tbone.models.base.make();
    myModel(function () {'{'}
        var count = myModel('user.count');
        var price = T('row.price');
        $('#total').text('$' + (count * price));
    {'}'});
        </pre>
        <p className="reveal-2">
            If you don{"'"}t like <strong>T</strong>, you can use <strong>tbone</strong>.
        </p>
        <p className="reveal-2">
            Or make your own and call it whatever you want.
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Divergence from Backbone
        </h1>
        <p>
            TBone now has its own implementation of Views and Models, and it runs with or without Backbone.
        </p>
        <p className="reveal-1">
            The biggest difference is that TBone supports setting a model to any value, not just a single-level hashmap.
        </p>
        <pre className="reveal-2">
    &gt; var model = tbone.models.base.make();
    &gt; // '' means "root of model":
    &gt; model('', {'[{ name: "Sally" }, { name: "Susan" }]);'}
    &gt; model('1.name')
    &rarr; "Susan"
    &gt; model('', 42);
    &gt; model('');
    &rarr; 42
        </pre>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Location Model
        </h1>
        <p>
            This model can read &amp; write the location.hash property:
        </p>
        <pre className="reveal-1">
    {"tbone.models.location = tbone.models.base.extend({"}
    {"    initialize: function () {"}
    {"        var self = this;"}
    {"        $(window).bind('hashchange', function () {"}
    {"            self('hash', location.hash);"}
    {"        });"}
    {"        self('hash', location.hash);"}
    {"        self(function () {"}
    {"            if (location.hash !== self('hash')) {"}
    {"                location.hash = self('hash');"}
    {"            }"}
    {"        });"}
    {"    }"}
    {"});"}
        </pre>
        <p className="reveal-2">
            Try it out!  This presentation creates an instance at T('location').
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Ajax models
        </h1>
        <div tbone="tmpl example root examplesByName.Ajax_Requests"></div>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Ajax sleepy-time
        </h1>
        <div tbone="tmpl example root examplesByName.The_Sleeping_XHR" className="sleeping-xhr"></div>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h3>
            Dependencies
        </h3>
        <ul>
            <li>Underscore</li>
            <li>JQuery or Zepto</li>
        </ul>
        <h3 className="reveal-1">
            Browsers
        </h3>
        <p className="reveal-1">
            <a href="/test/" target="_blank">Unit tests</a> pass in IE7+, Chrome, Firefox, Opera, and Safari.  Unit tests cover the reactive programming stuff well, and the view stuff a little less so.  There may be some rough edges in IEs, particularly with the view/template stuff.
        </p>
        <h3 className="reveal-2">
            Size
        </h3>
        <ul className="reveal-2">
            <li>Dev version, with comments: 28kiB gzipped</li>
            <li>Prod version: 7kiB gzipped</li>
        </ul>
        <h3 className="reveal-3">
            License
        </h3>
        <p  className="reveal-3" style={{textAlign: 'center'}}>
            <a href="https://github.com/appneta/tbone/blob/master/LICENSE" target="_blank">MIT</a>
        </p>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            Thanks!
        </h1>
        <br/>
        <h3>
            Questions?
        </h3>
        <br/>
        <br/>
        <h4>
            Slides at <a href="http://tbonejs.org/preso/" target="_blank">tbonejs.org/preso</a>
        </h4>
        <br/>
        <h4>
            <a href="https://github.com/appneta/tbone/" target="_blank">github.com/appneta/tbone</a>
        </h4>
        <h4>
            <a href="https://github.com/appneta/bbvis/" target="_blank">github.com/appneta/bbvis</a>
        </h4>
        <br/>
        <a href="/" target="_blank">
            <h1 className="tbone-logo">
                TBone
            </h1>
        </a>
        <a href="http://tillberg.us/about" target="_blank">
            <h3 className="author">
                Dan Tillberg
            </h3>
        </a>
        <a href="http://dev.appneta.com" target="_blank">
            <h3 className="appneta-logo">
                AppNeta
            </h3>
        </a>
      </Slide>
    );
  },
  function () {
    return (
      <Slide>
        <h1>
            This presentation uses TBone
        </h1>
        <p>
            You can see this presentation online at <a href="http://tbonejs.org/preso/" target="_blank">tbonejs.org/preso</a>.
        </p>
        <p>
            Source at <a href="https://github.com/appneta/tbonejs.org/" target="_blank">github.com/appneta/tbonejs.org</a>.
        </p>
        <br/>
        <p className="reveal-1">
            <img className="tbone-preso-bbvis" src="/preso/tbone_preso_bbvis.png"/>
        </p>
      </Slide>
    );
  },
];
