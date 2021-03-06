;
/** @define {boolean} */
var TBONE_BUILD_RELEASE = false;
(function(){

var root;
var _;
// Export TBone for Node.js or for the browser
if (typeof exports !== 'undefined') {
    _ = require('underscore')['_'];
    root = exports;
} else {
    root = window;
    _ = root['_'];
}

/** @const {boolean} */
var TBONE_DEBUG = !TBONE_BUILD_RELEASE && !!root['TBONE_DEBUG'];

var models = {};
var collections = {};
var templates = {};
var views = {};
var opts = TBONE_DEBUG ? { 'aliasCheck': false } : {};

/**
 * Scheduling priority constants
 *
 * The scheduler will update views and models in this order:
 * 1) synchronous (local) models
 * 2) views
 * 3) asynchronous (ajax) models
 *
 * The goals of this ordering are:
 * - never render a view based on an outdated model that
 *   we can update immediately.
 * - defer ajax requests until we know that something in the
 *   UI needs its data.
 */
/** @const */
var BASE_PRIORITY_MODEL_SYNC = 3000;
/** @const */
var BASE_PRIORITY_VIEW = 2000;
/** @const */
var BASE_PRIORITY_MODEL_ASYNC = 1000;

var priority = {
    'highest': 10000,
    'bound': BASE_PRIORITY_MODEL_SYNC,
    'beforeViews': BASE_PRIORITY_VIEW + 500,
    'view': BASE_PRIORITY_VIEW,
    'afterViews': BASE_PRIORITY_VIEW - 500,
    'async': BASE_PRIORITY_MODEL_ASYNC,
    'lowest': 0
};

/**
 * We also use the drainQueue to initialize models & views.  By adding this delta
 * to priorities for initialization, we ensure that initialization happens in the
 * same order as execution and that it happens before execution.  For example, it
 * may be inefficient for a model to reset before a model that it depends on has
 * initialized, as dependency chains will not yet be established.
 * XXX Does this really matter?  Or matter much?
 * @const
 */
var PRIORITY_INIT_DELTA = 5000;

function identity (x) { return x; }

function noop () { return undefined; }

function isFunction (x) {
    return typeof x === 'function';
}

function isString(x) {
    return typeof x === 'string';
}

function isRealNumber(x) {
    return typeof x === 'number' && !isNaN(x);
}

function isObject(x) {
    return x !== null && typeof x === 'object' && !isDate(x);
}

function isDate(x) {
    return !!(x && x.getTimezoneOffset && x.setUTCFullYear);
}

function isQueryable(x) {
    return !!(x && typeof x['query'] === 'function');
}

function isBoolean(x) {
    return typeof x === 'boolean';
}

var objectToString = Object.prototype.toString;
function isArray(x) {
    return objectToString.call(x) === '[object Array]';
}

function warn() {
    if (TBONE_DEBUG) {
        console.warn.apply(console, arguments);
    }
}
function error() {
    if (TBONE_DEBUG) {
        console.error.apply(console, arguments);
    }
}

/** @const */
var ERROR = 1;
/** @const */
var WARN = 2;
/** @const */
var INFO = 3;
/** @const */
var VERBOSE = 4;

var logLevels = {
    type: {

    },
    context: {

    },
    event: {

    },
    base: WARN
};

function watchLog (name, level) {
    if (level == null) { level = VERBOSE; }
    logLevels.type[name] = VERBOSE;
    logLevels.context[name] = VERBOSE;
    logLevels.event[name] = VERBOSE;
}

var _showRenderTrees = false;
function showRenderTrees () {
    _showRenderTrees = true;
}

function logRender (obj) {
    if (TBONE_DEBUG && _showRenderTrees) {
        console.log('render ' + _.times(renderDepth, function () { return '.'; }).join('') + obj.Name);
    }
}

var events = [];

var viewRenders = 0;

var logCallbacks = [];

function log () {
    if (TBONE_DEBUG) {
        for (var i = 0; i < logCallbacks.length; i++) {
            logCallbacks[i].apply(this, arguments);
        }
    }
}

/**
 * Log an event.  The event is piped to the JS console if the level is less than or equal to the
 * matched maximum log level based on the logLevels configuration above.
 * @param  {Number}                                    level   Log level: 1=error, 2=warn, 3=info, 4=verbose
 * @param  {string|Backbone.Model|Backbone.View|Scope} context What is logging this event
 * @param  {string}                                    event   Short event type string
 * @param  {string|Object}                             msg     Message string with tokens that will be
 *                                                             rendered from data.  Or just relevant data.
 * @param  {Object=}                                   data    Relevant data
 */
function logconsole (level, context, event, msg, data, moredata) {
    var name = isString(context) ? context : context['Name'];
    var type = (isString(context) ? context :
                context.isModel ? 'model' :
                context.isView ? 'view' :
                context.isScope ? 'scope' : '??');
    var threshold = Math.max(logLevels.context[name] || 0,
                             logLevels.event[event] || 0,
                             logLevels.type[type] || 0) || logLevels.base;
    if (event === 'lookups') {
        msg = _.reduce(msg, function(memo, map, id) {
            memo[map['obj']['Name'] || ('tboneid-' + map['obj'].tboneid)] = map;
            return memo;
        }, {});
    }
    if (level <= threshold) {
        /**
         * If a msg is a string, render it as a template with data as the data.
         * If msg is not a string, just output the data below.
         */
        var templated = isString(msg) ? _.template(msg, data || {}) : '';
        var includeColon = !!templated || !!msg;
        var frame = type === name ? type : (type + ' ' + name);
        var message = frame + ' / ' + event + (includeColon ? ': ' : '');
        var logfn = console[(level === ERROR ? 'error' : level === WARN ? 'warn' : 'log')];
        if (logfn && logfn.call) {
            logfn.call(console, message, templated || msg || '', moredata || '');
        }
    }
}

function onLog (cb) {
    logCallbacks.push(cb);
}

function denullText(v) {
    return (isString(v) || isRealNumber(v) || isDate(v) || isBoolean(v)) ? v + '' : '';
}

/**
 * Returns the list of unique listeners attached to the specified model/view.
 * @param  {Backbone.Model|Backbone.View} self
 * @return {Array.<Backbone.Model|Backbone.View|Scope>} array of listeners
 */
function getListeners(self) {
    var listeners = [];
    // Older backbone:
    _.each(_.values(self['_callbacks'] || {}), function (ll) {
        var curr = ll.next;
        while (true) {
            if (curr.context) {
                listeners.push(curr.context);
                curr = curr.next;
            } else {
                break;
            }
        }
    });
    // Newer backbone:
    _.each(_.flatten(_.values(self['_events'] || {})), function (ev) {
        if (ev.context) {
            listeners.push(ev.context);
        }
    });
    // TBone-native:
    if (isQueryable(self) && isFunction(self)) {
        var stack = [ self['_events'] ];
        var next, callbacks, k;

        while (!!(next = stack.pop())) {
            for (k in next) {
                if (k === '') {
                    callbacks = next[''];
                    for (var contextId in callbacks) {
                        listeners.push(callbacks[contextId]);
                    }
                } else {
                    stack.push(next[k]);
                }
            }
        }
    }

    return _.uniq(listeners);
}

/**
 * Returns true if there is a view that is listening (directly or indirectly)
 * to this model.  Useful for determining whether the current model should
 * be updated (if a model is updated in the forest and nobody is there to
 * hear it, then why update it in the first place?)
 * @param  {Backbone.Model|Backbone.View}  self
 * @return {Boolean}
 */
function hasViewListener(self) {
    var todo = [ self ];
    var usedModels = [ self ];
    while (todo.length) {
        var next = todo.pop();
        var listeners = getListeners(next);
        for (var i = 0; i < listeners.length; i++) {
            var listener = listeners[i];
            if (listener.isScope) {
                // The listener context is the model or view to whom the scope belongs.
                // Here, we care about that model/view, not the scope, because that's
                // what everyone else might be listening to.
                listener = listener.context;
            }
            // listener might be undefined right now if the scope above didn't have a context.
            if (listener) {
                if (listener.isView) {
                    // We found a view that depends on the original model!
                    return true;
                }
                // listener could also have been a scope with a context that was neither
                // a model nor a view.
                if (listener.isModel) {
                    if (usedModels.indexOf(listener) === -1) {
                        todo.push(listener);
                        usedModels.push(listener);
                    }
                }
            }
        }
    }
    return false;
}

/**
 * scheduler/timer.js
 */

function now () {
    return new Date().getTime();
}

/**
 * Returns a function that returns the elapsed time.
 * This is only used when TBONE_DEBUG is set, and should get removed
 * entirely by the release compile.
 * @return {function(): Number} Function that returns elapsed time.
 */
function timer() {
    var started;
    var cumulative;
    var me = {
        stop: function () {
            cumulative = now() - started;
        },
        start: function () {
            started = now();
        },
        done: function () {
            me.stop();
            timers.pop();
            if (timers.length) {
                timers[timers.length - 1].start();
            }
            return cumulative;
        }
    };
    me.start();
    if (timers.length) {
        timers[timers.length - 1].stop();
    }
    timers.push(me);
    return me;
}

var timers = [ ];


/**
 * tbone.autorun
 *
 * Wrap a function call with automatic binding for any model properties accessed
 * during the function's execution.
 *
 * Models and views update automatically by wrapping their reset functions with this.
 *
 * Additionally, this can be used within postRender callbacks to section off a smaller
 * block of code to repeat when its own referenced properties are updated, without
 * needing to re-render the entire view.
 * @param  {Function}                       fn        Function to invoke
 * @param  {number}                         priority  Scheduling priority - higher = sooner
 * @param  {Backbone.Model|Backbone.View}   context   Context to pass on invocation
 * @param  {string}                         name      Name for debugging purposes
 * @return {Scope}                                    A new Scope created to wrap this function
 */
function autorun(fn, priority, context, name, onExecuteCb, onExecuteContext, detached) {
    // Default priority and name if not specified.  Priority is important in
    // preventing unnecessary refreshes of views/subscopes that may be slated
    // for destruction by a parent; the parent should have priority so as
    // to execute first.
    if (!priority) {
        priority = currentExecutingScope ? currentExecutingScope.priority - 1 : 0;
    }
    if (!name && currentExecutingScope) {
        name = currentExecutingScope.Name + '+';
    }

    // Create a new scope for this function
    var scope = new Scope(fn, context, priority, name, onExecuteCb, onExecuteContext);

    // If this is a subscope, add it to its parent's list of subscopes.
    if (!detached && currentExecutingScope) {
        currentExecutingScope.subScopes.push(scope);
    }

    // Run the associated function (and bind associated models)
    scope.execute();

    // Return the scope object; this is used by BaseView to destroy
    // scopes when the associated view is destroyed.
    return scope;
}

function runOnlyOnce (fn) {
    var alreadyRun;
    autorun(function () {
        if (!alreadyRun) {
            fn();
        }
    });
    alreadyRun = true;
}

/**
 * scheduler/scope.js
 */

/**
 * currentExecutingScope globally tracks the current executing scope, so that subscopes
 * created during its execution (i.e. by tbone.autorun) can register themselves as
 * subscopes of the parent (this is important for recursive destruction of scopes).
 */
var currentExecutingScope;

var recentLookups;

/**
 * An autobinding function execution scope.  See autorun for details.
 * @constructor
 */
function Scope(fn, context, priority, name, onExecuteCb, onExecuteContext) {
    _.extend(this, {
        fn: fn,
        context: context,
        priority: priority,
        'Name': name,
        onExecuteCb: onExecuteCb,
        onExecuteContext: onExecuteContext,
        subScopes: []
    });
}

_.extend(Scope.prototype,

    /** @lends {Scope.prototype} */ {

    /**
     * Used to identify that an object is a Scope
     * @type {Boolean}
     */
    isScope: true,

    /**
     * Queue function execution in the scheduler
     */
    trigger: function () {
        queueExec(this);
    },

    /**
     * Execute the wrapped function, tracking all values referenced through lookup(),
     * and binding to those data sources such that the function is re-executed whenever
     * those values change.  Each execution re-tracks and re-binds all data sources; the
     * actual sources bound on each execution may differ depending on what is looked up.
     */
    execute: function () {
        var self = this;
        var myTimer;
        if (!self.destroyed) {
            if (TBONE_DEBUG) {
                myTimer = timer();
            }

            self.unbindAll();
            self.destroySubScopes();
            // Save our parent's lookups and subscopes.  It's like pushing our own values
            // onto the top of each stack.
            var oldLookups = recentLookups;
            this.lookups = recentLookups = {};
            var parentScope = currentExecutingScope;
            currentExecutingScope = self;

            // ** Call the payload function **
            // This function must be synchronous.  Anything that is looked up using
            // tbone.lookup before this function returns (that is not inside a subscope)
            // will get bound below.
            if (TBONE_DEBUG) {
                self.fn.call(self.context);
            } else {
                try {
                    self.fn.call(self.context);
                } catch (ex) {
                    /**
                     * This could be improved.  But it's better than not being able
                     * to see the errors at all.
                     */
                    tbone.push('__errors__.' + self['Name'], (ex && ex.stack || ex) + '');
                }
            }

            _.each(recentLookups, function (propMap) {
                var obj = propMap['obj'];
                var props = propMap['props'];
                if (props['']) {
                    obj.on('change', self.trigger, self);
                } else {
                    for (var prop in props) {
                        obj.on('change:' + prop, self.trigger, self);
                    }
                }
            });

            // This is intended primarily for diagnostics.
            if (self.onExecuteCb) {
                self.onExecuteCb.call(self.onExecuteContext, this);
            }

            // Pop our own lookups and parent scope off the stack, restoring them to
            // the values we saved above.
            recentLookups = oldLookups;
            currentExecutingScope = parentScope;

            if (TBONE_DEBUG) {
                var executionTimeMs = myTimer.done();
                log(VERBOSE, self, 'exec', '<%=priority%> <%=duration%>ms <%=name%>', {
                    'priority': self.priority,
                    'Name': self['Name'],
                    'duration': executionTimeMs
                });
                if (executionTimeMs > 10) {
                    log(VERBOSE, self, 'slowexec', '<%=priority%> <%=duration%>ms <%=name%>', {
                        'priority': self.priority,
                        'Name': self['Name'],
                        'duration': executionTimeMs
                    });
                }
            }
        }
    },

    /**
     * For each model which we've bound, tell it to unbind all events where this
     * scope is the context of the binding.
     */
    unbindAll: function () {
        var self = this;
        var lookups = self.lookups || {};
        for (var objId in lookups) {
            var propMap = lookups[objId];
            var obj = propMap['obj'];
            var props = propMap['props'];
            for (var prop in props) {
                obj.off('change:' + prop, null, self);
            }
        }
    },

    /**
     * Destroy any execution scopes that were creation during execution of this function.
     */
    destroySubScopes: function () {
        for (var i = 0; i < this.subScopes.length; i++) {
            this.subScopes[i].destroy();
        }
        this.subScopes = [];
    },

    /**
     * Destroy this scope.  Which means to unbind everything, destroy scopes recursively,
     * and ignore any execute calls which may already be queued in the scheduler.
     */
    destroy: function () {
        this.destroyed = true;
        this.unbindAll();
        this.destroySubScopes();
    }
});

/**
 * scheduler/drainqueue.js
 */

/**
 * Generate and return a unique identifier which we attach to an object.
 * The object is typically a view, model, or scope, and is used to compare
 * object references for equality using a hash Object for efficiency.
 * @param  {Object} obj Object to get id from ()
 * @return {string}     Unique ID assigned to this object
 */
function uniqueId(obj) {
    return obj['tboneid'] = obj['tboneid'] || nextId++; // jshint ignore:line
}
var nextId = 1;

/**
 * List of Scopes to be executed immediately.
 * @type {Array.<Scope>}
 */
var schedulerQueue = [];

/**
 * Flag indicating that the schedulerQueue is unsorted.
 * @type {Boolean}
 */
var dirty;

/**
 * Hash map of all the current Scope uniqueIds that are already
 * scheduled for immediate execution.
 * @type {Object.<string, Boolean>}
 */
var scopesQueued = {};

/**
 * Pop the highest priority Scope from the schedulerQueue.
 * @return {Scope} Scope to be executed next
 */
function pop() {
    /**
     * The schedulerQueue is lazily sorted using the built-in Array.prototype.sort.
     * This is not as theoretically-efficient as standard priority queue algorithms,
     * but Array.prototype.sort is fast enough that this should work well enough for
     * everyone, hopefully.
     */
    if (dirty) {
        schedulerQueue.sort(function (a, b) {
            /**
             * TODO for sync models, use dependency graph in addition to priority
             * to order execution in such a way as to avoid immediate re-execution.
             */
            return a.priority - b.priority;
        });
        dirty = false;
    }
    return schedulerQueue.pop();
}

/**
 * Flag indicating whether a drainQueue timer has already been set.
 */
var drainQueueTimer;

/**
 * Dynamic counter of how many ajax requests are inflight.
 * @type {Number}
 */
var inflight = 0;

function isReady () {
    return !inflight && !drainQueueTimer;
}

var isReadyTimer;

function updateIsReady () {
    if (!isReadyTimer) {
        isReadyTimer = setTimeout(function () {
            tbone['query']('__isReady__', isReady());
            tbone['query']('__ajaxReady__', !inflight);
            tbone['query']('__numAjaxInFlight__', inflight);
            isReadyTimer = null;
        }, 20);
    }
}

/**
 * Queue the specified Scope for execution if it is not already queued.
 * @param  {Scope}   scope
 */
function queueExec (scope) {
    var contextId = uniqueId(scope);
    if (!scopesQueued[contextId]) {
        scopesQueued[contextId] = true;

        /**
         * Push the scope onto the queue of scopes to be executed immediately.
         */
        schedulerQueue.push(scope);

        /**
         * Mark the queue as dirty; the priority of the scope we just added
         * is not immediately reflected in the queue order.
         */
        dirty = true;

        /**
         * If a timer to draing the queue is not already set, set one.
         */
        if (!drainQueueTimer && !(TBONE_DEBUG && frozen)) {
            updateIsReady();
            drainQueueTimer = _.defer(drainQueue);
        }
    }
}

var frozen = false;

/**
 * Attempt to restore scrollTop around drainQueue calls.
 *
 * The basic problem is that removing and re-adding elements to the page
 * will force the scroll up to the minimum height that the page gets to
 * in the midst of that operation.
 *
 * This is really kind of kludgy... Is there a cleaner way to accomplish
 * the same thing?

 * Only supported for JQuery / when scrollTop is available on $.
 */

var origScrollTop = this.$ && $.fn && $.fn.scrollTop;
var $window = origScrollTop && $(window);
var scrollTopChangedProgrammatically;

if (origScrollTop) {
    /**
     * Avoid clobbering intentional programmatic scrollTop changes that
     * occur inside T-functions.  This is not foolproof, and only preserves
     * changes made through $.fn.scrollTop.
     *
     * XXX This could frustrate users that try to change it some other way,
     * only to find that somehow, mysteriously, the scrollTop change gets
     * reverted.
     */
    $.fn.scrollTop = function (value) {
        if (value) {
            scrollTopChangedProgrammatically = true;
        }
        return origScrollTop.apply(this, arguments);
    };
}

function queryScrollTop (value) {
    return origScrollTop && (value ? $window.scrollTop(value) : $window.scrollTop());
}

/**
 * Drain the Scope execution queue, in priority order.
 */
function drainQueue () {
    scrollTopChangedProgrammatically = false;
    var scrollTop = queryScrollTop();
    drainQueueTimer = null;
    var queueDrainStartTime = now();
    var scope;
    var remaining = 5000;
    while (!(TBONE_DEBUG && frozen) && --remaining && !!(scope = pop())) {
        /**
         * Update the scopesQueued map so that this Scope may be requeued.
         */
        delete scopesQueued[uniqueId(scope)];

        /**
         * Execute the scope, and in turn, the wrapped function.
         */
        scope.execute();
    }
    if (!remaining) {
        log(WARN, 'scheduler', 'drainQueueOverflow', 'exceeded max drainQueue iterations');
        drainQueueTimer = _.defer(drainQueue);
    }
    log(VERBOSE, 'scheduler', 'drainQueue', 'ran for <%=duration%>ms', {
        'duration': now() - queueDrainStartTime
    });
    log(VERBOSE, 'scheduler', 'viewRenders', 'rendered <%=viewRenders%> total', {
        'viewRenders': viewRenders
    });
    updateIsReady();
    if (scrollTop && !scrollTopChangedProgrammatically && scrollTop !== queryScrollTop()) {
        queryScrollTop(scrollTop);
    }
}

/**
 * Drain to the tbone drainQueue, executing all queued Scopes immediately.
 * This is useful both for testing and MAYBE also for optimizing responsiveness by
 * draining at the end of a keyboard / mouse event handler.
 */
function drain () {
    if (drainQueueTimer) {
        clearTimeout(drainQueueTimer);
    }
    drainQueue();
}

function freeze () {
    frozen = true;
}


/**
 * "Don't Get Data" - Special flag for query to return the model/collection instead
 * of calling toJSON() on it.
 * @const
 */
var DONT_GET_DATA = 1;

/**
 * "Iterate Over Models" - Special flag for query to return an iterator over the
 * models of the collection, enabling iteration over models, which is what we want
 * to do when using _.each(collection ...) in a template, as this allows us to
 * use model.query(...) and properly bind references to the models.
 * @const
 */
var ITERATE_OVER_MODELS = 2;

/**
 * @const
 */
var QUERY_PUSH = 3;

/**
 * @const
 */
var QUERY_UNSHIFT = 4;

/**
 * @const
 */
var QUERY_REMOVE_FIRST = 5;

/**
 * @const
 */
var QUERY_REMOVE_LAST = 6;

/**
 * @const
 */
var QUERY_TOGGLE = 7;

/**
 * @const
 */
var QUERY_UNSET = 8;

/**
 * @const
 */
var QUERY_INCREMENT = 9;

/**
 * If you want to select the root, you can either pass __self__ or just an empty
 * string; __self__ is converted to an empty string and this "flag" is used to
 * check for whether we are selecting either.
 * @const
 */
var QUERY_SELF = '';

/**
 * @const
 */
var MAX_RECURSIVE_DIFF_DEPTH = 16;

function recursiveDiff (self, evs, curr, prev, exhaustive, depth, fireAll) {
    // Kludge alert: if the objects are too deep, just assume there is
    // a change.
    if (depth > MAX_RECURSIVE_DIFF_DEPTH) {
        log(WARN, self, 'recurseLimit', 'hit recursion depth limit of <%=limit%>', {
            limit: MAX_RECURSIVE_DIFF_DEPTH
        }, {
            curr: curr,
            prev: prev
        });
        return true;
    }
    evs = evs || {};
    curr = curr;
    prev = prev;
    if (isQueryable(prev) || isQueryable(curr)) {
        // The only reason either prev or curr should be queryable is if
        // we're setting a model where there previous was none (or vice versa).
        // In this case, *all* descendant events must be rebound to the new
        // model by firing them all immediately.
        fireAll = true;
    }
    var changed = fireAll;
    var k, i, n;
    for (k in evs) {
        if (k === QUERY_SELF) {
            if (prev !== curr) {
                // If prev and curr are both "object" types (but not null),
                // then we need to search recursively for "real" changes.
                // We want to avoid firing change events when the user sets
                // something to a deep copy of itself.
                if (isObject(prev) && isObject(curr)) {
                    exhaustive = true;
                } else if (isDate(prev) && isDate(curr)) {
                    changed = (prev.getTime() !== curr.getTime()) || changed;
                } else {
                    changed = true;
                }
            }
        } else {
            changed = recursiveDiff(
                self, evs[k], curr && curr[k], prev && prev[k], false, depth + 1, fireAll) || changed;
        }
    }
    if (exhaustive && !changed) {
        // If exhaustive specified, and we haven't yet found a change, search
        // through all keys until we find one (note that this could duplicate
        // some searching done while searching the event tree)
        // This may not be super-efficient to call recursiveDiff all the time.
        if (isObject(prev) && isObject(curr)) {
            // prev and curr are both objects/arrays
            // search through them recursively for any differences
            var searched = {};
            var objs = [prev, curr];
            for (i = 0; i < 2 && !changed; i++) {
                var obj = objs[i];
                if (isArray(obj)) {
                    if (prev.length !== curr.length) {
                        changed = true;
                    }
                    for (k = 0; k < obj.length && !changed; k++) {
                        if (!searched[k]) {
                            searched[k] = true;
                            if (recursiveDiff(self, evs[k], curr[k], prev[k], true, depth + 1, false)) {
                                changed = true;
                            }
                        }
                    }
                } else {
                    for (k in obj) {
                        if (!searched[k]) {
                            searched[k] = true;
                            if (recursiveDiff(self, evs[k], curr[k], prev[k], true, depth + 1, false)) {
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }
        } else if (isDate(prev) && isDate(curr)) {
            changed = prev.getTime() !== curr.getTime();
        } else if (prev !== curr) {
            // at least one of prev and curr is a primitive (i.e. not arrays/objects)
            // and they are different.  thus, we've found a change and will pass this
            // outward so that we know to fire all parent callbacks
            changed = true;
        }
    }
    if (changed) {
        var contexts = evs[QUERY_SELF] || {};
        for (var contextId in contexts) {
            contexts[contextId].trigger.call(contexts[contextId]);
        }
    }
    return changed;
}

/**
 * serialize the model in a semi-destructive way.  We don't really care
 * about the result as long as we can use it to test for anything that
 * gets changed behind TBone's back (i.e. by changing arrays/objects that
 * TBone has stored).
 *
 * This is only ever called if TBONE_DEBUG is true.
 */
function serializeForComparison(model) {
    if (opts['aliasCheck']) {
        try {
            var attributes = model.attributes;
            return JSON.stringify(attributes === undefined ? null : attributes, function (key, value) {
                // If value is an array or object, screen its keys for queryables.
                // Queryables track their own changes, so we don't care to
                // check that they haven't changed without this model knowing.
                if (isObject(value)) {
                    // This is not a way to serialize correctly, but
                    // we just want to show that the original structures
                    // were the same, minus queryables.
                    var localized = {};
                    for (var k in value) {
                        if (!isQueryable(value[k])) {
                            localized[k] = value[k];
                        }
                    }
                    return localized;
                } else {
                    return value;
                }
            });
        } catch (e) {
            log(WARN, model, 'aliascheck', 'Failed to serialize attributes to JSON');
        }
    }
    return "null";
}

function listDiffs(curr, prev, accum) {
    var diffs = {};
    if (isObject(prev) && isObject(curr)) {
        var searched = {};
        var objs = [prev, curr];
        for (var i = 0; i < 2; i++) {
            var obj = objs[i];
            for (var k in obj) {
                if (!searched[k]) {
                    searched[k] = true;
                    _.extend(diffs, listDiffs(prev[k], curr[k], accum.concat(k)));
                }
            }
        }
    } else {
        if (prev !== curr) {
            diffs[accum.join('.')] = prev + ' -> ' + curr;
        }
    }
    return diffs;
}

function query(flag, prop, value) {
    var self = this;
    var dontGetData = flag === DONT_GET_DATA;
    var iterateOverModels = flag === ITERATE_OVER_MODELS;
    var isPush = flag === QUERY_PUSH;
    var isUnshift = flag === QUERY_UNSHIFT;
    var isRemoveFirst = flag === QUERY_REMOVE_FIRST;
    var isRemoveLast = flag === QUERY_REMOVE_LAST;
    var isToggle = flag === QUERY_TOGGLE;
    var isIncrement = flag === QUERY_INCREMENT;
    var isListOp = isPush || isUnshift || isRemoveFirst || isRemoveLast;
    var isUnset = flag === QUERY_UNSET;
    var hasValue = arguments.length === 3;
    var isSet = isListOp || isToggle || isUnset || hasValue || isIncrement;
    if (typeof flag !== 'number') {
        /**
         * If no flag provided, shift the prop and value over.  We do it this way instead
         * of having flag last so that we can type-check flag and discern optional flags
         * from optional values.  And flag should only be used internally, anyway.
         */
        value = prop;
        prop = flag;
        flag = 0;
        /**
         * Use arguments.length to switch to set mode in order to properly support
         * setting undefined.
         */
        if (arguments.length === 2) {
            isSet = true;
            hasValue = true;
        }
    }

    /**
     * Remove a trailing dot and __self__ references, if any, from the prop.
     **/
    prop = (prop || '').replace('__self__', '');
    var argParts = prop.split('.');
    var args = [];
    var i;
    for (i = 0; i < argParts.length; i++) {
        // Ignore empty string arguments.
        if (argParts[i]) {
            args.push(argParts[i]);
        }
    }

    /**
     * For set operations, we only want to look up the parent of the property we
     * are modifying; pop the final property we're setting from args and save it
     * for later.
     * @type {string}
     */
    var setprop = args[args.length - 1] || 'attributes';

    /**
     * If this function was called with a bindable context (i.e. a Model or Collection),
     * then use that as the root data object instead of the global tbone.data.
     */
    var last_data = self;

    /**
     * If DONT_GET_DATA, and there's no prop, then this is a self-reference.
     */
    var _data = dontGetData && !prop ? self : self.attributes;

    var name_parts = [];
    var id;
    var arg;
    var doSubQuery;
    var parentCallbackContexts = {};
    var events = isSet && self['_events']['change'];

    while (true) {
        if (_data == null && !isSet) {
            // Couldn't even get to the level of the value we're trying to look up.
            // Concat the rest of args onto name_parts so that we record the full
            // path in the event binding.
            name_parts = name_parts.concat(args);
            break;
        } else if (_data !== self && isQueryable(_data)) {
            /**
             * To avoid duplicating the recentLookups code here, we set a flag and do
             * the sub-query after recording queries.
             *
             * Always do the subquery if there are more args.
             * If there are no more args...
             * - and this is a set...
             *   - (but really an unset): Don't do the sub-query regardless.
             *   -        to a queryable: Don't sub-query.  Set property to new queryable.
             *   -    to a non-queryable: Do the sub-query.  Push the value to the
             *                            other model (don't overwrite the model).  This
             *                            is kind of magical?
             * - and this is a get...
             *   -    with DONT_GET_DATA: Don't do sub-query.  Get the model itself.
             *   - without DONT_GET_DATA: Do the sub-query.  Delegate getting that model's
             *                            data to the other model.
             */
            doSubQuery = args.length || (isSet ? !isUnset && !isQueryable(value) : !dontGetData);
            break;
        } else if (isSet && !isObject(_data) && (args.length || isListOp)) {
            /**
             * Don't do implicit mkdir -p if we're just trying to unset something
             * that doesn't exist.
             */
            if (isUnset) {
                return;
            }
            /**
             * When doing an implicit mkdir -p while setting a deep-nested property
             * for the first time, we peek at the next arg and create either an array
             * for a numeric index and an object for anything else.  We set the
             * property via query() so as to fire change events appropriately.
             */
            if (_data != null) {
                log(WARN, this, 'mkdir', 'while writing <%=prop%>, had to overwrite ' +
                    'primitive value <%=primitive%> at <%=partial%>', {
                        prop: prop,
                        primitive: _data,
                        partial: name_parts.join('.')
                    });
            }
            /**
             * Decide whether to implicitly create an array or an object.
             *
             * If there are args remaining, then use the next arg to determine;
             * for a number, create an array - anything else, an object.
             *
             * If there are no more args, then create an array if this is a list
             * operation; otherwise, an object.
             */
            _data = (args.length ? rgxNumber.exec(args[0]) : isListOp) ? [] : {};
            self['query'](name_parts.join('.'), _data);
        }

        arg = args.shift();
        if (arg == null) { break; }

        name_parts.push(arg);
        last_data = _data;

        _data = _data[arg];
        if (events) {
            _.extend(parentCallbackContexts, events[QUERY_SELF] || {});
            events = events[arg];
        }
    }

    if (!isSet && recentLookups) {
        id = uniqueId(self);
        if (!recentLookups[id]) {
            recentLookups[id] = {
                'obj': self,
                'props': {}
            };
        }
        recentLookups[id]['props'][name_parts.join('.')] = _data;
    }

    if (doSubQuery) {
        return hasValue ? _data['query'](flag, args.join('.'), value) : _data['query'](flag, args.join('.'));
    }

    if (isSet) {
        /**
         * Only do prevJson comparisons when setting the root property.
         * It's kind of complicated to detect and avoid aliasing issues when
         * setting other properties directly.  But at least this helps detect
         * aliasing for bound models.
         */
        if (TBONE_DEBUG && self.prevJson && !prop) {
            var json = serializeForComparison(self);
            if (json !== self.prevJson) {
                var before = JSON.parse(self.prevJson);
                var after = JSON.parse(json);
                var diffs = listDiffs(after, before, []);
                log(WARN, self, 'aliascheck', 'aliased change detected', {}, {
                    before: before,
                    after: after,
                    diffs: diffs
                });
            }
        }

        // XXX Kludge Alert.  In practice, gives many models a Name that otherwise
        // wouldn't have one by using the first prop name it is set to.  Works for
        // the typical T('modelName', model.make()) and T.push cases.
        var nameProp;

        if (isPush) {
            if (TBONE_DEBUG) {
                nameProp = prop + '.' + _data.length;
            }
            _data.push(value);
        } else if (isUnshift) {
            _data.unshift(value);
        } else if (isRemoveFirst) {
            _data.shift(value);
        } else if (isRemoveLast) {
            _data.pop(value);
        } else if (isUnset) {
            delete last_data[setprop];
        } else if (isToggle) {
            value = last_data[setprop] = !_data;
        } else if (isIncrement) {
            value = last_data[setprop] = (_data || 0) + value;
        } else {
            last_data[setprop] = value;
            if (TBONE_DEBUG) {
                nameProp = prop;
            }
        }

        if (TBONE_DEBUG && isQueryable(value)) {
            if (value['Name'] == null) {
                value['Name'] = nameProp;
            }
            if (value.scope && value.scope['Name'] == null) {
                value.scope['Name'] = 'model_' + nameProp;
            }
        }

        if (!_.isEmpty(parentCallbackContexts)) {
            // If there are any changes at all, then we need to fire one or more
            // callbacks for things we searched for.  Note that "parent" only includes
            // things from this model; change events don't bubble out to parent models.
            if (recursiveDiff(self, events, _data, value, true, 0, false)) {
                for (var contextId in parentCallbackContexts) {
                    parentCallbackContexts[contextId].trigger.call(parentCallbackContexts[contextId]);
                }
            }
        } else {
            recursiveDiff(self, events, _data, value, false, 0, false);
        }

        if (TBONE_DEBUG) {
            self.prevJson = prop ? null : serializeForComparison(self);
        }
        return value;
    } else if (!iterateOverModels && self.isCollection && prop === '') {
        /**
         * If iterateOverModels is not set and _data is a collection, return the
         * raw data of each model in a list.  XXX is this ideal?  or too magical?
         */
        if (isArray(_data)) {
            _data = _.map(_data, function (d) { return d['query'](); });
        } else if (_data) {
            _data = _.reduce(_.keys(_data), function (memo, k) {
                if (isQueryable(_data[k])) {
                    memo[k] = _data[k]['query']();
                }
                return memo;
            }, {});
        }
    }
    return _data;
}

function queryText(flag, prop) {
    return denullText(prop == null ? this['query'](flag) : this['query'](flag, prop));
}

/**
 * model/core/base.js
 */

/**
 * @type {RegExp}
 * @const
 */
var rgxEventSplitter = /[.]+/;

/**
 * Split name parameter into components (used in .on() and .trigger())
 *
 * For compatibility with backbone, we support using the colon as the
 * separator between "change" and the remainder of the terms, but only
 * dots after that.
 */
function splitName (name) {
    return name.replace(/^change:/, 'change.').split(rgxEventSplitter);
}

/**
 * baseModel
 * @constructor
 */
var baseModel = {
    isModel: true,
    make: function (opts) {
        var self = this;
        // Each TBone model/collection is an augmented copy of this TBoneModel function
        var instance = function TBoneModel (arg0, arg1, arg2) {
            if (typeof arg0 === 'function') {
                return autorun(arg0, arg1);
            } else if (typeof arg1 === 'function' && !isQueryable(arg1)) {
                return instance['query'](arg0, boundModel.extend({ 'state': arg1 }).make());
            } else {
                return (arguments.length === 0 ? instance['query']() :
                        arguments.length === 1 ? instance['query'](arg0) :
                        arguments.length === 2 ? instance['query'](arg0, arg1) :
                                                 instance['query'](arg0, arg1, arg2));
            }
        };
        _.extend(instance, self, isFunction(opts) ? { 'state': opts } : opts || {});

        // Initialize the model instance
        delete instance['tboneid'];
        delete instance['attributes'];
        if (TBONE_DEBUG) {
            delete instance.prevJson;
        }
        instance['_events'] = {};
        instance._removeCallbacks = {};
        uniqueId(instance);
        instance['initialize']();

        return instance;
    },
    'extend': function (subclass) {
        return _.extend({}, this, subclass);
    },
    'initialize': noop,
    'on': function (name, callback, context) {
        // XXX callback is not supported.  assumes context.trigger is the callback
        var parts = splitName(name);
        var events = this['_events'];
        var arg;

        while ((arg = parts.shift()) != null) {
            if (arg === '') {
                continue;
            }
            if (!events[arg]) {
                events[arg] = {};
            }
            events = events[arg];
        }
        var contexts = events[''];
        if (!contexts) {
            contexts = events[''] = {};
        }
        var contextId = uniqueId(context);
        contexts[contextId] = context;

        /**
         * Wake up and reset this and other models that may be sleeping because
         * they did not need to be updated.
         */
        this.wake({});
    },
    'off': function (name, callback, context) {
        // XXX only supports use with both name & context.
        // XXX doesn't clean up when callbacks list goes to zero length
        var parts = splitName(name);
        var events = this['_events'];
        var arg;

        while ((arg = parts.shift()) != null) {
            if (arg === '') {
                continue;
            }
            if (!events[arg]) {
                events[arg] = {};
            }
            events = events[arg];
        }
        var contexts = events[''];
        if (contexts) {
            var contextId = uniqueId(context);
            delete contexts[contextId];
        }
    },
    'trigger': function (name) {
        var self = this;
        var events = self['_events'];
        var parts = splitName(name);
        var arg;
        while ((arg = parts.shift()) != null) {
            if (arg === '') {
                continue;
            }
            if (!events[arg]) {
                events[arg] = {};
            }
            events = events[arg];
        }
        var contexts = events[QUERY_SELF] || {};
        for (var contextId in contexts) {
            contexts[contextId].trigger.call(contexts[contextId]);
        }
    },

    'runOnlyOnce': runOnlyOnce,

    'query': query,

    'queryModel': function (prop) {
        return this['query'](DONT_GET_DATA, prop);
    },

    // query `prop` without binding to changes in its value
    'readSilent': function (prop) {
        var tmp = recentLookups;
        recentLookups = null;
        var rval = this['query'](prop);
        recentLookups = tmp;
        return rval;
    },

    'idAttribute': 'id',

    'queryId': function () {
        return this['query'](this['idAttribute']);
    },

    'toggle': function (prop) {
        this['query'](QUERY_TOGGLE, prop);
    },

    'push': function (prop, value) {
        if (arguments.length === 1) {
            value = prop;
            prop = '';
        }
        this['query'](QUERY_PUSH, prop, value);
    },

    'unshift': function (prop, value) {
        if (arguments.length === 1) {
            value = prop;
            prop = '';
        }
        this['query'](QUERY_UNSHIFT, prop, value);
    },

    'removeFirst': function (prop) {
        this['query'](QUERY_REMOVE_FIRST, prop);
    },

    'removeLast': function (prop) {
        this['query'](QUERY_REMOVE_LAST, prop);
    },

    'unset': function (prop) {
        this['query'](QUERY_UNSET, prop);
    },

    'increment': function (prop, value) {
        this['query'](QUERY_INCREMENT, prop, value != null ? value : 1);
    },

    'clear': function () {
        this['query']('', undefined);
    },

    'toJSON': function () {
        return this.attributes;
    },

    wake: noop,

    'queryText': queryText, // deprecated
    'text': queryText, // deprecated
    'lookup': query, // deprecated
    'lookupText': queryText, // deprecated
    'set': query, // deprecated
    'get': query // deprecated
};

if (TBONE_DEBUG) {
    baseModel['find'] = function (obj) {
        function recurse(o, depth) {
            if (depth > 10) {
                return [];
            }
            if (o === obj) {
                return [];
            }
            if (isQueryable(o)) {
                if (!!(result = recurse(o.attributes, depth + 1))) {
                    return result;
                }
            } else if (o !== null && typeof o === 'object') {
                var result;
                if (o.push) {
                    for (var i = 0; i < o.length; i++) {
                        if (!!(result = recurse(o[i], depth + 1))) {
                            result.unshift(k);
                            return result;
                        }
                    }
                } else {
                    for (var k in o) {
                        if (!!(result = recurse(o[k], depth + 1))) {
                            result.unshift(k);
                            return result;
                        }
                    }
                }
            }
        }
        var result = recurse(this.attributes, 0);
        return result ? result.join('.') : null;
    };
}

/**
 * model/core/bound.js
 */

var boundModel = baseModel.extend({
    /**
     * Constructor function to initialize each new model instance.
     * @return {[type]}
     */
    'initialize': function () {
        var self = this;
        /**
         * Queue the autorun of update.  We want this to happen after the current JS module
         * is loaded but before anything else gets updated.  We can't do that with setTimeout
         * or _.defer because that could possibly fire after drainQueue.
         */
        self.scope = autorun(self.update, self.scopePriority, self,
                             self['Name'] && 'model_' + self['Name'],
                             self.onScopeExecute, self, true);
    },

    scopePriority: BASE_PRIORITY_MODEL_SYNC,

    /**
     * Wake up this model as well as (recursively) any models that depend on
     * it.  Any view that is directly or indirectly depended on by the current
     * model may now be able to be awoken based on the newly-bound listener to
     * this model.
     * @param  {Object.<string, Boolean>} woken Hash map of model IDs already awoken
     */
    wake: function (woken) {
        // Wake up this model if it was sleeping
        if (this.sleeping) {
            this.sleeping = false;
            this.reset();
        }
        /**
         * Wake up models that depend directly on this model that have not already
         * been woken up.
         * XXX - how does this work?
         */
        _.each((this.scope && this.scope.lookups) || [], function (lookup) {
            var bindable = lookup['obj'];
            if (bindable && !woken[uniqueId(bindable)]) {
                woken[uniqueId(bindable)] = true;
                bindable.wake(woken);
            }
        });
    },

    onScopeExecute: function (scope) {
        log(INFO, this, 'lookups', scope.lookups);
    },

    update: function () {
        var self = this;
        self.sleeping = self['sleepEnabled'] && !hasViewListener(self);
        if (self.sleeping) {
            /**
             * This model will not update itself until there's a view listener
             * waiting for data (directly or through a chain of other models)
             * from this model.
             */
            log(INFO, self, 'sleep');
        } else {
            self._update();
        }
    },

    _update: function () {
        this['query'](QUERY_SELF, this['state']());
        log(VERBOSE, this, 'updated', this.attributes);
    },

    /**
     * Triggers scope re-execution.
     */
    reset: function () {
        if (this.scope) {
            this.scope.trigger();
        }
    },

    'destroy': function () {
        if (this.scope) {
            this.scope.destroy();
        }
        this['unset'](QUERY_SELF);
    },

    /**
     * returns the new state, synchronously
     */
    'state': noop,

    'sleepEnabled': false
});

/**
 * model/core/async.js
 */

var asyncModel = boundModel.extend({
    _update: function () {
        var self = this;
        // Allow updates that are as new or newer than the last *update* generation.
        // This allows rolling updates, where the model may have one or more requests
        // in flight for newer data, yet it will still accept earlier-generation
        // data that arrives as long as it is newer than what it had before.
        var reqGeneration = self.reqGeneration = (self.reqGeneration || 0) + 1;
        var opts = self['state'](function (value) {
            if (reqGeneration >= (self.updateGeneration || 0)) {
                self.updateGeneration = reqGeneration;
                self.abortCallback = null;
                self['query']('', value);
                return true;
            }
            return undefined;
        });
        self.abortCallback = opts && opts['onAbort'];
    },

    'abortPrevious': function () {
        if (this.abortCallback) {
            this.abortCallback();
        }
    },

    scopePriority: BASE_PRIORITY_MODEL_ASYNC
});


var nextTempId = 1;

var baseCollection = baseModel.extend({
    isCollection: true,
    // The only place isModel is checked is in hasViewListener.
    // For that function's purposes, TBone collections are models.
    // It might be better to remove isModel and use isQueryable instead.
    isModel: true,
    'model': baseModel,

    'add': function (data) {
        var self = this;
        var child;
        var lastId;

        /**
         * If data is already a queryable (presumably an instance of baseModel), then
         * use that.  Otherwise, instantiate a model and initialize it with data.
         */
        if (isQueryable(data)) {
            child = data;
        } else {
            child = self['model'].make();
            child['query']('', data);
        }

        /**
         * Watch the child model's idAttribute, updating its location in this
         * collection (which is an object, not an array) in case the child's id
         * changes.  The latter is mostly useful in case the ID is not set
         * initially.  In this case, we assign a temporary ID so that it gets
         * included when iterating over the collection.
         */
        var removed;
        var update = function () {
            if (lastId != null) {
                self['unset'](lastId, null);
                self['trigger']('change:' + lastId);
                delete self._removeCallbacks[lastId];
            }
            if (!removed) {
                var id = child['queryId']();
                if (id == null) {
                    id = '__unidentified' + (nextTempId++);
                }
                id = '#' + id;
                self['query'](id, child);
                self['trigger']('change:' + id);
                self._removeCallbacks[id] = remove;
                lastId = id;
            }
        };
        self['increment']('size');
        var remove = function () {
            self['increment']('size', -1);
            removed = true;
            update();
        };
        autorun(update);
    },

    /**
     * It might be helpful to override `push` with a null or with a function
     * that logs an error in dev mode to avoid confusion with cases where
     * the user could be steered to use a model as a simple list.
     */

    /**
     * Remove a model by ID or by model instance.
     */
    'remove': function (modelOrId) {
        modelOrId = '#' + (isQueryable(modelOrId) ? modelOrId['queryId']() : modelOrId);
        if (this._removeCallbacks[modelOrId]) {
            this._removeCallbacks[modelOrId]();
        }
    }
});

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  function sync(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: tbone.emulateHTTP,
      emulateJSON: tbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && window.ActiveXObject &&
          !(window.external && window.external.msActiveXFilteringEnabled)) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = model.ajax(_.extend(params, options));
    // model.trigger('request', model, xhr, options);
    return xhr;
  }

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

/**
 * model/fancy/ajax.js
 */

var ajaxModel = asyncModel.extend({

    'state': function (dataCallback) {
        var self = this;
        var myXhr;
        function complete() {
            if (myXhr) {
                inflight--;
                myXhr = null;
                self['onComplete']();
            }
        }

        var url = self.url();
        if (url != null && url !== self.fetchedUrl) {
            /**
             * If a defined URL function returns null, it will prevent fetching.
             * This can be used e.g. to prevent loading until all required
             * parameters are set.
             **/
            self.fetchedUrl = url;
            self['abortPrevious']();
            if (self['clearOnFetch']) {
                self.clear();
            }
            sync('read', self, {
                'dataType': 'text',
                'success': function (resp) {
                    /**
                     * dataCallback returns true if this update was accepted (i.e.
                     * is of the current async update generation).  So only fire
                     * the postFetch callback, etc, when the update actually sticks.
                     */
                    if (dataCallback(self.parse(resp))) {
                        self['postFetch']();
                        self.trigger('fetch');
                        log(INFO, self, 'updated', self.attributes);
                    }
                },
                'complete': complete,
                'beforeSend': function (xhr) {
                    inflight++;
                    myXhr = xhr;
                    xhr['__tbone__'] = true;
                },
                'url': url
            });
        }
        return {
            onAbort: function () {
                // If we have an active XHR in flight, we should abort
                // it because we don't want that anymore.
                if (myXhr) {
                    log(WARN, self, 'abort',
                        'aborting obsolete ajax request. old url: <%=oldurl%>', {
                        'oldurl': self.fetchedUrl
                    });
                    myXhr.abort();
                    complete();
                }
            }
        };
    },

    'parse': identity,

    /**
     * By default, async models will use $.ajax to fetch data; override this
     * with something else if desired.
     */
    'ajax': function () {
        return $.ajax.apply($, arguments);
    },

    'postFetch': noop,

    'onComplete': noop,

    'clearOnFetch': true, // XXX move to async model

    'sleepEnabled': true

});

/**
 * model/fancy/localstorage.js
 */

var localStorageModel = baseModel.extend({
    /**
     * To use, extend this model and specify key as a property.
     *
     * For example:
     * var metrics = tbone.models.localStorage.make({ key: 'metrics' });
     * metrics.increment('pageloads');
     * console.log(metrics.query('pageloads'));
     */

    initialize: function () {
        var self = this;
        self['query']('', JSON.parse(localStorage[self['key']] || "null"));
        autorun(function () {
            localStorage[self['key']] = JSON.stringify(self.query(''));
        });
    }
});

/**
 * model/fancy/location.js
 */

var locationModel = baseModel.extend({
    /**
     * Example:
     * var loc = tbone.models.location.make();
     * T(function () {
     *     console.log('the hash is ' + loc('hash'));
     * });
     * loc('hash', '#this-is-the-new-hash');
     */
    initialize: function () {
        var self = this;
        function updateHash () {
            self('hash', location.hash);
        }
        $(window).bind('hashchange', function () {
            updateHash();
        });
        updateHash();

        self(function () {
            var hash = self('hash');
            if (location.hash !== hash) {
                location.hash = hash;
            }
        });
    }
});

/**
 * model/fancy/localstoragecoll.js
 */

var localStorageCollection = baseCollection.extend({
    initialize: function () {
        var self = this;
        var stored = JSON.parse(localStorage[self.key] || "null");
        _.each(stored || [], function (modelData) {
            self.add(modelData);
        });
        autorun(function () {
            localStorage[self.key] = JSON.stringify(self['query']());
        });
    }
});

/**
 * dom/template/init.js
 */

/**
 * Convenience function to generate a RegExp from a string.  Spaces in the original string
 * are re-interpreted to mean a sequence of zero or more whitespace characters.
 * @param  {String} str
 * @param  {String} flags
 * @return {RegExp}
 */
function regexp(str, flags) {
    return new RegExp(str.replace(/ /g, '[\\s\\n]*'), flags);
}

/**
 * Capture the contents of any/all underscore template blocks.
 * @type {RegExp}
 * @const
 */
var rgxLookup = /<%(=|-|@|)([\s\S]+?)%>/g;

/**
 * Find function declaractions (so that we can detect variables added to the closure scope
 * inside a template, as well as start and end of scope).
 * @type {RegExp}
 * @const
 */
var rgxScope = regexp(
    'function \\( ([\\w$_]* (, [\\w$_]+)*)  \\)|' +
    '(\\{)|' +
    '(\\})|' +
    '([\\s\\S])', 'g');

/**
 * Match function parameters found in the first line of rgxScope.
 * @type {RegExp}
 * @const
 */
var rgxArgs = /[\w$_]+/g;

/**
 * When used with string.replace, rgxUnquoted matches unquoted segments with the first group
 * and quoted segments with the second group.
 * @type {RegExp}
 * @const
 */
var rgxUnquoted = /([^'"]+)('[^']+'|"[^"]+")?/g;

/**
 * Find references that are not subproperty references of something else, e.g. ").hello"
 * @type {RegExp}
 * @const
 */
var rgxLookupableRef = regexp('(\\. )?(([\\w$_]+)(\\.[\\w$_]+)*)', 'g');

/**
 * Use to test whether a string is in fact a number literal.  We don't want to instrument those.
 * @type {RegExp}
 * @const
 */
var rgxNumber = /^\d+$/;

/**
 * Hashmap of properties to never try to tbone.lookup when instrumenting a template.
 * @type {Object.<string, Boolean>}
 */
var neverLookup = {};

_.each(('break case catch continue debugger default delete do else finally for function if in ' +
        'instanceof new return switch this throw try typeof var void while with ' +
        'Array Boolean Date Function Iterator Number Object RegExp String ' +
        'isFinite isNaN parseFloat parseInt Infinity JSON Math NaN undefined true false null ' +
        '$ _ tbone T view window'
       ).split(' '), function (word) {
    neverLookup[word] = true;
});

/**
 * Don't tbone-query-patch variables starting with **namespace** in tbone.addTemplate.
 * For example, if you have a formatting library at `window.stringz`, use
 * `tl.dontPatch('stringz')` so that you can use stringz from within templates,
 * e.g. `<%= stringz.formatMoney(account.balance) %>`.
 * @param  {string} namespace
 */
function dontPatch (namespace) {
    neverLookup[namespace] = true;
}

/**
 * Adds listeners for model value lookups to a template string
 * This allows us to automatically and dynamically bind to change events on the models
 * to auto-refresh this template.
 */
function withLookupListeners(str, closureVariables) {
    return str.replace(rgxLookupableRef, function (all, precedingDot, expr, firstArg) {
        if (neverLookup[firstArg] || precedingDot || rgxNumber.test(firstArg)) {
            return all;
        } else {
            if (closureVariables[firstArg] != null) {
                /**
                 * If the first part of the expression is a closure-bound variable
                 * e.g. from a _.each iterator, try to do a lookup on that (if it's
                 * a model).  Otherwise, just do a native reference.
                 */
                return [
                    '(',
                    firstArg,
                    ' && view.isQueryable(',
                    firstArg,
                    ') ? ',
                    firstArg,
                    '.query("',
                    expr.slice(firstArg.length + 1),
                    '")',
                    ' : ',
                    expr,
                    ')'
                ].join('');
            } else {
                /**
                 * Patch the reference to use query.
                 */
                return [
                    'view.query(',
                    ITERATE_OVER_MODELS,
                    ', "',
                    expr,
                    '")'
                ].join('');
            }
        }
    });
}

/**
 * Add a template to be used later via render.
 * @param {string} name   template name; should match tbone attribute references
 * @param {string} string template as HTML string
 */
function addTemplate(name, string) {
    templates[name] = string;
}

/**
 * Instrument the template for automatic reference binding via tbone.lookup/lookupText.
 * @param  {string} string Uninstrumented template as an HTML string
 * @return {function(Object): string}
 */
function initTemplate(string) {
    /**
     * As we parse through the template, we identify variables defined as function parameters
     * within the current closure scope; if a variable is defined, we instrument references to
     * that variable so that they use that variable as the lookup root, instead of using the
     * view context.  We push each new closure scope's variables onto varstack and pop them
     * off when we reach the end of the closure.
     * @type {Array.<Array.<string>>}
     */
    var varstack = [[]];
    /**
     * Hash set of variables that are currently in scope.
     * @type {Object.<string, boolean>}
     */
    var inClosure = {};

    function updateInClosure() {
        /**
         * Rebuild the hash set of variables that are "in closure scope"
         */
        inClosure = _['invert'](_.flatten(varstack));
    }
    updateInClosure();
    /**
     * First, find code blocks within the template.
     */
    var parsed = string.replace(rgxLookup, function (__, textOp, contents) {
        /**
         * List of accumulated instrumentable characters.
         * @type {Array.<string>}
         */
        var cs = [];

        /**
         * Inside the rgxScope replace function, we push unmatched characters one by one onto
         * cs.  Whenever we find any other input, we first flush cs by calling cs_parsed.
         * This calls withLookupListeners which does the magic of replacing native JS references
         * with calls to lookup or lookupText where appropriate.
         */
        function cs_parsed() {
            /**
             * Pass the accumulated string to withLookupListeners, replacing variable
             * references with calls to lookup.
             */
            var instrumented = withLookupListeners(cs.join(''), inClosure);
            cs = [];
            return instrumented;
        }

        var isDataRef = textOp === '@';
        if (isDataRef) {
            textOp = '';
        }

        /**
         * Find unquoted segments within the code block.  Pass quoted segments through unmodified.
         */
        var newContents = contents.replace(rgxUnquoted, function (__, unquoted, quoted) {
            /**
             * Process the unquoted segments, taking note of variables added in closure scope.
             * We should not lookup-patch variables that are defined in a closure (e.g. as the
             * looping variable of a _.each).
             */
            return unquoted.replace(rgxScope, function (all, args, __, openScope, closeScope, c) {
                if (c) {
                    /**
                     * Push a single character onto cs to be parsed in cs_parsed.  Obviously, not
                     * the most efficient mechanism possible.
                     */
                    cs.push(c);
                    return '';
                }
                if (openScope) {
                    /**
                     * We found a new function declaration; add a new closure scope to the stack.
                     */
                    varstack.push([]);
                } else if (args) {
                    /**
                     * We found an argument list for this function; add each of the arguments to
                     * the closure scope at the top of the stack (added above).
                     */
                    args.replace(rgxArgs, function (arg) {
                        varstack[varstack.length - 1].push(arg);
                    });
                } else if (closeScope) {
                    /**
                     * We found the closing brace for a closure scope.  Pop it off the stack to
                     * reflect that any variables attached to it are no longer in scope.
                     */
                    varstack.pop();
                }
                updateInClosure();
                /**
                 * Flush cs, and in addition to that, return the function/variables/brace that we
                 * just found.
                 */
                return cs_parsed() + all;
            }) + cs_parsed() + (quoted || '');
        }) + cs_parsed();
        return '<%' + (
            isDataRef ?
                ('= view.getHashId(' + newContents + ') ') :
                textOp ?
                    // if this is a text op (= or -), pass it through denullText
                    (textOp + 'view.denullText(' + newContents + ')') :
                    newContents
            ) + '%>';

    });

    /**
     * Pass the template to _.template.  It will create a function that takes a single "view"
     * parameter.  On render, we'll pass either a model/collection or tbone itself as the view.
     * @type {Function}
     */
    var fn = _.template(parsed, null, { 'variable': 'view' });

    if (TBONE_DEBUG) {
        /**
         * For debugging purposes, save a copy of the parsed template for reference.
         * @type {string}
         */
        fn.parsed = parsed;
    }

    return fn;
}

/**
 * dom/template/render.js
 */

/**
 * Render the named template with the specified view
 * @param {string} id
 * @param {View}   view
 */
function renderTemplate(id, view) {
    var template = templates[id];
    if (template == null) {
        // Attempt to lazy-load the template from a script tag, e.g.
        // <script name="<id>" type="text/tbone-tmpl">...</script>
        // The type doesn't matter, per se, but you should specify one so
        // as not to have your template parsed as javascript.
        template = $('script[name="' + id + '"]').html();
        if (!template) {
            error('Could not find template ' + id + '.  If you don\'t want to ' +
                  'use a template, use the view attribute instead.');
            return '';
        }
    }
    if (typeof template === 'string') {
        template = templates[id] = initTemplate(template);
    }
    return template(view);
}

/**
 * dom/hash.js
 */

var hashedObjectCache = {};

/**
 * @const
 */
var HEXCHARS = '0123456789ABCDEF';

/**
 * getHashId
 *
 * Get hash ID for an object, converting the object to a model with the original
 * object as its contents if necessary.  The hash is stored in hashedObjectCache
 * so that object can be retrieved after parsing the HTML generated by the template.
 */
function getHashId(obj) {
    if (!isQueryable(obj)) {
        var instaModel = tbone['make']();
        instaModel['query']('', obj);
        obj = instaModel;
    }
    if (!obj.hashId) {
        var hashArray = [];
        for (var i = 20; i; i--) {
            hashArray.push(HEXCHARS.charAt(Math.floor(Math.random() * HEXCHARS.length)));
        }
        obj.hashId = hashArray.join('');
    }
    hashedObjectCache[obj.hashId] = obj;
    return obj.hashId;
}

/**
 * dom/view/base.js
 */

var renderDepth = 0;

var baseView = {
    make: function (opts) {
        var instance = {};
        _.extend(instance, this);
        instance['initialize'](opts);
        return instance;
    },
    'extend': function (subclass) {
        return _.extend({}, this, subclass, { parentView: this });
    },

    '$': function(selector) {
        return this['$el'].find(selector);
    },

    isView: true,

    'initialize': function (opts) {
        var self = this;
        uniqueId(self);
        _.extend(self, opts);
        self['$el'] = $(self['el']);
        self['el']['view'] = self;
        self.priority = self.domParentView ? self.domParentView.priority - 1 : BASE_PRIORITY_VIEW;
        self.scope = autorun(self.render, self.priority, self, 'view_' + self['Name'],
                             self.onScopeExecute, self, true);
    },

    onScopeExecute: function (scope) {
        log(INFO, this, 'lookups', scope.lookups);
    },

    /**
     * View.destroy
     *
     * Destroys this view, removing all bindings and sub-views (recursively).
     */
    destroy: function (destroyRoot) {
        var self = this;
        log(VERBOSE, self, 'destroy', 'due to re-render of ' + destroyRoot['Name']);
        self.destroyed = true;
        self.scope.destroy();
        _.each(self.subViews || [], function (view) {
            view.destroy(self);
        });
        self['destroyDOM'](self.$el);
    },

    /**
     * View.render
     *
     * This function is called at View init, and again whenever any model properties that this View
     * depended on are changed.
     */
    render: function () {
        var self = this;
        // This view may get a reset call at the same instant that another
        // view gets created to replace it.
        if (!self.destroyed) {
            logRender(self);
            renderDepth++;

            /**
             * Move all this view's children to another temporary DOM element.  This will be used as the
             * pseudo-parent element for the destroyDOM call.
             */
            if (self.templateId) {
                /**
                 * If the DOM fragment to be removed has an active (focused) element, we attempt
                 * to restore that focus after refreshing this DOM fragment.  We also attempt
                 * to restore the selection start/end, which only works in Webkit/Gecko right
                 * now; see the URL below for possible IE compatibility.
                 */
                var activeElement = document.activeElement;
                var activeElementSelector, activeElementIndex, selectionStart, selectionEnd;
                if (_.contains($(activeElement).parents(), self.el)) {
                    // XXX this could be improved to pick up on IDs/classes/attributes or something?
                    activeElementSelector = 'input';
                    activeElementIndex = _.indexOf(self.$(activeElementSelector), activeElement);
                    // XXX for IE compatibility, this might work:
                    // http://the-stickman.com/web-development/javascript/ ...
                    // finding-selection-cursor-position-in-a-textarea-in-internet-explorer/
                    // Only try to get the selectionStart and selectionEnd for inputs that have
                    // text in them.  I don't know if submit/button types are the only ones that
                    // will fail here, so maybe it'd just be either to wrap this in a try/catch.
                    var inputType = activeElement.getAttribute('type');
                    if (inputType !== 'submit' && inputType !== 'button') {
                        selectionStart = activeElement.selectionStart;
                        selectionEnd = activeElement.selectionEnd;
                    }
                }

                var $old = $('<div>').append(this.$el.children());
                var newHtml = renderTemplate(self.templateId, self);
                log(INFO, self, 'newhtml', newHtml);
                self.$el.html(newHtml);

                /**
                 * Execute the "fragment ready" callback.
                 */
                self['ready']();
                self['postReady']();

                /**
                 * (Re-)create sub-views for each descendent element with a tbone attribute.
                 * On re-renders, the pre-existing list of sub-views is passed to render, which
                 * attempts to pair already-rendered views with matching elements in this view's
                 * newly re-rendered template.  Matching views are transferred to the new DOM
                 * hierarchy without disruption.
                 */
                var oldSubViews = self.subViews || [];
                self.subViews = render(self.$('[tbone]'), self, oldSubViews);
                var obsoleteSubViews = _.difference(oldSubViews, self.subViews);
                /**
                 * Destroy all of the sub-views that were not reused.
                 */
                _.each(obsoleteSubViews, function (view) {
                    view.destroy(self);
                });
                /**
                 * Call destroyDOM with the the pseudo-parent created above.  This DOM fragment contains all
                 * of the previously-rendered (if any) DOM structure of this view and subviews, minus any
                 * subviews that are being reused (which have already been moved to the new parent).
                 */
                self['destroyDOM']($old);

                /**
                 * If we saved it above, restore the active element focus and selection.
                 */
                if (activeElementSelector) {
                    var newActiveElement = self.$(activeElementSelector)[activeElementIndex];
                    if (newActiveElement) {
                        $(newActiveElement).focus();
                        if (selectionStart != null && selectionEnd != null) {
                            newActiveElement.selectionStart = selectionStart;
                            newActiveElement.selectionEnd = selectionEnd;
                        }
                    }
                }
            } else {
                self['ready']();
                self['postReady']();
            }
            self['postRender']();
            viewRenders++;

            renderDepth--;
        }
    },

    /**
     * View.ready
     *
     * The "template-ready" callback.  This is the restricted tbone equivalent of document-ready.
     * It is the recommended means of adding interactivity/data/whatever to Views.
     *
     * At the moment this callback is executed, subviews are neither rendered nor are they
     * attached to the DOM fragment.  If you need to interact with subviews, use postRender.
     */
    'ready': noop,

    /**
     * View.postReady
     *
     * This is the same as ready, except that it executes after ready.  The typical use case is
     * to override this in your base template to provide automatic application-wide helpers,
     * such as activating a tooltip library, and to use View.ready for specific view logic.
     */
    'postReady': noop,

    /**
     * View.postRender
     *
     * The "fragment-updated" callback.  This is executed whenever this view is re-rendered,
     * and after all sub-views (recursively) have rendered.
     *
     * Note that because we optimistically re-use sub-views, this may be called multiple times
     * with the same sub-view DOM fragments.  Ensure that anything you do to DOM elements in
     * sub-views is idempotent.
     */
    'postRender': noop,

    /**
     * View.destroyDOM
     *
     * The "document-destroy" callback.  Use this to do cleanup on removal of old HTML, e.g.
     * destroying associated tooltips.
     *
     * Note: Destroy contents of the $el parameter, not this.$el!  (XXX make this less error-prone)
     *
     * @param  {!jQuery} $el jQuery selection of DOM fragment to destroy
     */
    'destroyDOM': function ($el) { },

    /**
     * If a root attribute was specified, use that as the root object for this view's
     * render, both in templating automatically as well as available via this.root in
     * `ready` and `postRender` callbacks.
     */
    root: function () {
        return this['query'](DONT_GET_DATA);
    },

    /**
     * Perform a query relative to the view's rootObj and rootStr, delegating to
     * rootObj for the actual query but prepending rootStr to the prop string.
     **/
    'query': function (flag, prop, value) {
        var isSet = false;
        if (typeof flag !== 'number') {
            /**
             * If no flag provided, shift the prop and value over.  We do it this way instead
             * of having flag last so that we can type-check flag and discern optional flags
             * from optional values.  And flag should only be used internally, anyway.
             */
            value = prop;
            prop = flag;
            flag = 0;
            /**
             * Use arguments.length to switch to set mode in order to properly support
             * setting undefined.
             */
            isSet = arguments.length === 2;
        }
        prop = (this.rootStr ? this.rootStr + '.' : '') + (prop || '');
        return isSet ? this.rootObj(flag, prop, value) : this.rootObj(flag, prop);
    },

    'parentRoot': function () {
        return this.domParentView && this.domParentView.root();
    },

    /**
     * Get the DOM parent view, i.e. the view associated with the closest
     * ancestor DOM node that is a view root element.
     */
    'parent': function () {
        return this.domParentView;
    },

    // These are used at template render.  They're really not properties of views so much
    // as it is useful to reference these functions on the view, which is what we pass to
    // _.template already.
    'getHashId': getHashId,
    'isQueryable': isQueryable,
    'denullText': denullText

};

var defaultView = baseView;
/**
 * Set the default View to use when rendering templates with no matching View.
 * @param {ViewPrototype} view
 */
function setDefaultView(view) {
    defaultView = view;
}

/**
 * dom/view/render.js
 */

/**
 * Use to find key/value pairs in tbone attributes on render.
 * @type {RegExp}
 * @const
 */
var rgxTBoneAttribute = /[^\w.]*([\w.]+)[^\w.]+([\w.]+)/g;

/**
 * tbone.render
 *
 * Render an array of HTML elements into Views.  This reads the tbone attribute generates a View
 * for each element accordingly.
 *
 * @param  {Array.<DOMElement>}     $els     elements to render templates from
 * @param  {Backbone.View=}         parent   parent view
 * @param  {Array.<Backbone.View>=} subViews (internal) sub-views created previously; these are used
 *                                           to avoid redundantly regenerating unchanged views.
 * @return {Array.<Backbone.View>}           views created (and/or substituted from subViews)
 */
function render($els, parent, subViews) {
    var subViewMap = {};
    _.each(subViews || [], function (subView) {
        (subViewMap[subView.origOuterHTML] = subViewMap[subView.origOuterHTML] || []).push(subView);
    });
    return _.map($els, function (el) {
        var $this = $(el);
        var outerHTML = el.outerHTML;
        if (subViewMap[outerHTML] && subViewMap[outerHTML].length) {
            /**
             * If we have a pre-rendered view available with matching outerHTML (i.e. nothing in
             * the parent template has changed for this subview's root element), then just swap
             * the pre-existing element in place along with its undisturbed associated View.
             */
            var subView = subViewMap[outerHTML].shift();
            log(VERBOSE, parent || 'render', 'reuse', subView);
            $this.replaceWith(subView.el);
            return subView;
        } else {
            /**
             * Otherwise, read the tbone attribute from the element and use it to instantiate
             * a new View.
             */
            var props = {};
            ($this.attr('tbone') || '').replace(rgxTBoneAttribute, function(__, prop, value) {
                props[prop] = value;
            });
            var inlineTemplateId = props['inline'];
            if (inlineTemplateId) {
                /**
                 * XXX what's the best way to get the original html back?
                 */
                var origTemplateHtml = $this.html()
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&');
                addTemplate(inlineTemplateId, origTemplateHtml);
            }
            var templateId = inlineTemplateId || props['tmpl'];
            var viewId = props['view'];
            var root = props['root'];

            /**
             * Use either the view or template attributes as the `name` of the view.
             */
            var name = viewId || templateId;
            if (!name) {
                error('No view or template was specified for this element: ', el);
            }

            /**
             * Find the corresponding view matching the name (`viewId` or `templateId`) to the
             * name passed to `createView.`  If there is no view matching that name, then use
             * the default view.  You can set the default view using `tbone.defaultView().`
             * @type {function(new:Backbone.View, Object)}
             */
            var myView = views[name] || defaultView;

            /**
             * Add a class matching the view name for CSS.
             */
            $this.addClass(name);

            /**
             * Also add a class for each of the parent views, if any.
             */
            var parentView = myView.parentView;
            while (parentView && parentView['Name']) {
                $this.addClass(parentView['Name']);
                parentView = parentView.parentView;
            }

            var rootObj = hashedObjectCache[root] || tbone;

            var opts = {
                'Name': name,
                origOuterHTML: outerHTML,
                'el': el,
                templateId: templateId,
                domParentView: parent,
                rootObj: rootObj,
                rootStr: hashedObjectCache[root] ? '' : root
            };

            // This could potentially miss some cached objects (e.g.
            // if the subview was removed during view-ready execution)
            // Might be simpler just to clear hashedObjectCache when
            // the drainQueue finishes?
            delete hashedObjectCache[root];

            return myView.make(opts);
        }
    });
}

/**
 * dom/view/create.js
 */

/**
 * tbone.createView
 *
 * Create a new view, inheriting from another view (or the default view).
 *
 * This is the primary method you should use to add JS logic to your UI. e.g.:
 *
 * tbone.createView('widget', function () {
 *     this.$('span').text('42');
 *     this.$('a[href]').click(function () {
 *         tbone.set('selected.widget', $(this).attr('id'));
 *         return false;
 *     })
 * });
 *
 * The function above whenever a template renders an element with a tbone attribute
 * of "widget", and this.$ will be scoped to that view.
 *
 * All of the parameters are optional, though you're best off passing *something*.
 *
 * @param  {String=}               name Name for the view.
 * @param  {ViewPrototype=}        base Base view to extend.
 * @param  {function(this:View)=}  fn   convenience parameter for specifying ready
 *                                      function.
 * @param  {Object=}               opts additional prototype properties
 * @return {ViewPrototype}
 */
function createView(name, base, fn, opts) {
    var args = [].slice.call(arguments);
    var arg = args.shift();
    if (typeof arg === 'string') {
        name = arg;
        arg = args.shift();
    } else {
        name = 'v' + nextId++;
    }
    if (arg && arg.extend) {
        base = arg;
        arg = args.shift();
    } else {
        base = defaultView;
    }
    if (typeof arg === 'function') {
        fn = arg;
        arg = args.shift();
    } else {
        fn = null;
    }
    opts = _.extend({}, arg || {}, {
        'Name': name
    });
    var baseReady = base['ready'];
    if (fn) {
        opts['ready'] = baseReady === noop ? fn : function () {
            baseReady.call(this);
            fn.call(this);
        };
    }
    return views[name] = base.extend(opts); // jshint ignore:line
}


var tbone = baseModel.make({ 'Name': 'tbone' });

var orig_tbone = root['tbone'];
var orig_T = root['T'];

root['tbone'] = tbone;
root['T'] = tbone;

tbone['models'] = models;
tbone['views'] = views;
tbone['collections'] = collections;
tbone['templates'] = templates;

tbone['createView'] = createView;
tbone['setDefaultView'] = setDefaultView;
tbone['addTemplate'] = addTemplate;
tbone['dontPatch'] = dontPatch;
tbone['render'] = render;
tbone['denullText'] = denullText;
tbone['priority'] = priority;

// Included in minified source, but intended for TESTING only:
tbone['drain'] = drain;
tbone['isReady'] = isReady;

tbone['noConflict'] = function () {
    root['T'] = orig_T;
    root['tbone'] = orig_tbone;
};

/**
 * Core models
 */
models['base'] = baseModel;
models['bound'] = boundModel;
models['async'] = asyncModel;

/**
 * Fancy models
 */
models['ajax'] = ajaxModel;
models['localStorage'] = localStorageModel;
models['location'] = locationModel;

collections['base'] = baseCollection;
collections['localStorage'] = localStorageCollection;
views['base'] = baseView;

if (TBONE_DEBUG) {
    tbone['watchLog'] = watchLog;
    tbone['showRenderTrees'] = showRenderTrees;
    tbone['getListeners'] = getListeners;
    tbone['hasViewListener'] = hasViewListener;
    tbone['onLog'] = onLog;
    tbone['freeze'] = freeze;
    tbone['opts'] = opts;
    onLog(logconsole);
}

// This is used by BBVis to hook into the base model/collection/view
// before they are modified.  You can, too.
try{
    dispatchEvent(new CustomEvent('tbone_loaded'));
} catch(e) {}


var Backbone = root['Backbone'];

if (Backbone) {

    var bbquery = function (flag, prop, value) {
        var dontGetData = flag === DONT_GET_DATA;
        var iterateOverModels = flag === ITERATE_OVER_MODELS;
        var isToggle = flag === QUERY_TOGGLE;
        var hasValue = arguments.length === 3;
        var isSet = isToggle || hasValue;
        if (typeof flag !== 'number') {
            /**
             * If no flag provided, shift the prop and value over.  We do it this way instead
             * of having flag last so that we can type-check flag and discern optional flags
             * from optional values.  And flag should only be used internally, anyway.
             */
            value = prop;
            prop = flag;
            flag = 0;
            /**
             * Use arguments.length to switch to set mode in order to properly support
             * setting undefined.
             */
            if (arguments.length === 2) {
                isSet = true;
                hasValue = true;
            }
        }

        /**
         * Remove a trailing dot and __self__ references, if any, from the prop.
         **/
        prop = (prop || '').replace(/\.?(__self__)?\.?$/, '');
        var args = prop.split('.');

        var setprop;
        if (isSet) {
            /**
             * For set operations, we only want to look up the parent of the property we
             * are modifying; pop the final property we're setting from args and save it
             * for later.
             */
            setprop = args[args.length - 1];
        }

        /**
         * If this function was called with a bindable context (i.e. a Model or Collection),
         * then use that as the root data object instead of the global tbone.data.
         */
        var last_data;

        /**
         * If DONT_GET_DATA, and there's no prop, then this is a self-reference.
         */
        var _data = dontGetData && !prop ? this :
            this.isCollection ? this.models : this.attributes;

        var name_parts = [];
        var myRecentQuery = {};
        var firstprop = args[0] || '';
        var firstdata = prop ? _data[firstprop] : _data;
        var id;
        var arg;
        var doSubQuery;

        while ((arg = args.shift()) != null) {
            // Ignore empty string arguments.
            if (arg === QUERY_SELF) {
                continue;
            }

            name_parts.push(arg);
            last_data = _data;
            _data = _data[arg];

            if (_data == null) {
                if (isSet) {
                    /**
                     * When doing an implicit mkdir -p while setting a deep-nested property
                     * for the first time, we peek at the next arg and create either an array
                     * for a numeric index and an object for anything else.
                     */
                    _data = rgxNumber.exec(args[0]) ? [] : {};
                    last_data[arg] = _data;
                } else {
                    break;
                }
            } else if (isQueryable(_data)) {
                doSubQuery = true;
                break;
            }
        }

        if (!isSet && recentLookups) {
            id = uniqueId(this);
            if (!recentLookups[id]) {
                recentLookups[id] = {
                    'obj': this,
                    'props': {}
                };
            }
            recentLookups[id]['props'][firstprop] = firstdata;
        }

        // Skip the sub-query if DONT_GET_DATA is set there are no more args
        if (doSubQuery && (!dontGetData || args.length)) {
            return hasValue ? _data['query'](flag, args.join('.'), value) : _data['query'](flag, args.join('.'));
        }

        if (isSet) {
            if (last_data == null) {
                // Set top-level of model/collection
                /**
                 * When setting to an entire model, we use different semantics; we want the
                 * values provided to be set to the model, not replace the model.
                 */
                if (this.isCollection) {
                    this.reset(value != null ? value : []);
                } else {
                    if (value) {
                        /**
                         * Remove any properties from the model that are not present in the
                         * value we're setting it to.
                         */
                        for (var k in this.toJSON()) {
                            if (value[k] === undefined) {
                                this.unset(k);
                            }
                        }
                        this.set(value);
                    } else {
                        this.clear();
                    }
                }
            } else {
                if (isToggle) {
                    value = last_data[setprop] = !_data;
                } else if (last_data[setprop] !== value) {
                    /**
                     * Set the value to a property on a regular JS object.
                     */
                    last_data[setprop] = value;
                }
                /**
                 * If we're setting a nested property of a model (or collection?), then
                 * trigger a change event for the top-level property.
                 */
                if (firstprop) {
                    this.trigger('change:' + firstprop);
                }
                this.trigger('change');
            }
            return value;
        } else if (_data && !iterateOverModels && this.isCollection && prop === QUERY_SELF) {
            /**
             * If iterateOverModels is not set and _data is a collection, return the
             * raw data of each model in a list.  XXX is this ideal?  or too magical?
             */
            _data = _.map(_data, function (d) { return d['query'](); });
        }
        return _data;
    };

    var bbbaseModel = Backbone.Model.extend({
        isModel: true,
        /**
         * Constructor function to initialize each new model instance.
         * @return {[type]}
         */
        initialize: function () {
            var self = this;
            uniqueId(self);
            var isAsync = self.sleeping = self.isAsync();
            var priority = isAsync ? BASE_PRIORITY_MODEL_ASYNC : BASE_PRIORITY_MODEL_SYNC;
            /**
             * Queue the autorun of update.  We want this to happen after the current JS module
             * is loaded but before anything else gets updated.  We can't do that with setTimeout
             * or _.defer because that could possibly fire after drainQueue.
             */
            queueExec({
                execute: function () {
                    self.scope = autorun(self.update, priority, self, 'model_' + self['Name'],
                                         self.onScopeExecute, self);
                },
                priority: priority + PRIORITY_INIT_DELTA
            });
        },
        /**
         * Indicates whether this function should use the asynchronous or
         * synchronous logic.
         * @return {Boolean}
         */
        isAsync: function () {
            return !!this['_url'];
        },
        onScopeExecute: function (scope) {
            log(INFO, this, 'lookups', scope.lookups);
        },
        /**
         * Triggers scope re-execution.
         */
        reset: function () {
            if (this.scope) {
                this.scope.trigger();
            }
        },
        'isVisible': function () {
            return hasViewListener(this);
        },
        update: function () {
            var self = this;
            if (self.isAsync()) {
                self.updateAsync();
            } else {
                self.updateSync();
            }
        },
        updateAsync: function () {
            var self = this;
            var myXhr;
            function complete() {
                if (myXhr === self.xhrInFlight) {
                    inflight--;
                    delete self.xhrInFlight;
                }
            }

            var url = self.url();
            var lastFetchedUrl = self.fetchedUrl;
            self.sleeping = !this['isVisible']();
            if (self.sleeping) {
                /**
                 * Regardless of whether url is non-null, this model goes to sleep
                 * if there's no view listener waiting for data (directly or through
                 * a chain of other models) from this model.
                 **/
                log(INFO, self, 'sleep');
                self.sleeping = true;
            } else if (url != null && url !== lastFetchedUrl) {
                /**
                 * If a defined URL function returns null, it will prevent fetching.
                 * This can be used e.g. to prevent loading until all required
                 * parameters are set.
                 **/
                self.fetchedUrl = url;
                if (self['clearOnFetch']) {
                    self.clear();
                }
                self.fetch({
                    'dataType': 'text',
                    success: function () {
                        self['postFetch']();
                        self.trigger('fetch');
                        log(INFO, self, 'updated', self.toJSON());
                    },
                    'complete': complete,
                    'beforeSend': function (xhr) {
                        // If we have an active XHR in flight, we should abort
                        // it because we don't want that anymore.
                        if (self.xhrInFlight) {
                            log(WARN, self, 'abort',
                                'aborting obsolete ajax request. old: <%=oldurl%>, new: <%=newurl%>', {
                                'oldurl': lastFetchedUrl,
                                'newurl': url
                            });
                            self.xhrInFlight.abort();
                            complete(); // Decrement inflight counter
                        }
                        inflight++;
                        myXhr = self.xhrInFlight = xhr;
                        xhr['__tbone__'] = true;
                    },
                    url: url
                });
            }
        },
        updateSync: function () {
            var self = this;
            // this.state returns the new state, synchronously
            if (self['state']) {
                self['query'](QUERY_SELF, self['state']());
                log(INFO, self, 'updated', self.toJSON());
            }
        },
        'state': null,
        'postFetch': noop,

        'clearOnFetch': true
    });

    _.each([Backbone.Model.prototype, Backbone.Collection.prototype], function (proto) {
        _.extend(proto, {
            'isBackbone': true,

            /**
             * Copy query and text onto the Model, View, and Collection.
             *
             */
            'query': bbquery,
            'text': queryText,

            // deprecated?
            'lookup': bbquery,
            'lookupText': queryText,

            /**
             * Wake up this model as well as (recursively) any models that depend on
             * it.  Any view that is directly or indirectly depended on by the current
             * model may now be able to be awoken based on the newly-bound listener to
             * this model.
             * @param  {Object.<string, Boolean>} woken Hash map of model IDs already awoken
             */
            wake: function (woken) {
                // Wake up this model if it was sleeping
                if (this.sleeping) {
                    this.trigger('wake');
                    this.sleeping = false;
                    this.reset();
                }
                /**
                 * Wake up models that depend directly on this model that have not already
                 * been woken up.
                 */
                _.each((this.scope && this.scope.lookups) || [], function (lookup) {
                    var bindable = lookup['obj'];
                    if (bindable && !woken[uniqueId(bindable)]) {
                        woken[uniqueId(bindable)] = true;
                        bindable.wake(woken);
                    }
                });
            }
        });

        /**
         * We wrap proto.on in order to wake up and reset models
         * that were previously sleeping because they did not need to be updated.
         * This passes through execution to the original on function.
         */
        var originalOn = proto.on;
        proto['on'] = function () {
            this.wake({});
            return originalOn.apply(this, arguments);
        };
    });

    var bbModel = models['bbbase'] = bbbaseModel;
    var bbCollection = collections['bbbase'] = Backbone.Collection.extend({
        isCollection: true
    });

    _.each([bbModel, bbCollection], function (obj) {
        _.extend(obj.prototype, {
            /**
             * Disable backbone-based validation; by using validation to prevent populating
             * form input data to models, backbone validation is at odds with the TBone
             * concept that all data in the UI should be backed by model data.
             *
             * By overriding _validate, we can still use isValid and validate, but Backbone
             * will no longer prevent set() calls from succeeding with invalid data.
             */
            '_validate': function () { return true; }
        });
    });
}

}());
