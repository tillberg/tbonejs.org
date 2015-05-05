'use strict';

var _ = require('lodash');
var gulp = require('gulp');
var gutil = require('gulp-util');
// var react = require('gulp-react');
var del = require('del');
var less = require('gulp-less');
var prefix = require('gulp-autoprefixer');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var express = require('express');
var glob = require("glob");
var async = require('async');
// var request = require('request');

var fs = require('fs-extra');
var path = require('path');
var events = require('events');
var http = require('http');
var WebSocketServer = require('ws').Server;

var BUILD_PATH = '_tbonejsorg/';

try {
    fs.mkdirSync(BUILD_PATH);
} catch(e) {}

function restartOnException() {
    process.on('uncaughtException', function(err) {
        gutil.log('Uncaught exception');
        gutil.log(err.stack);
        gutil.log('Restarting in 5 seconds...');
        setTimeout(function() {
            console.log('Restarting.');
            process.exit(0);
        }, 3000);
    });
}

var updateNotifier = new events.EventEmitter();
function getReadyTask(type) {
    return function() {
        updateNotifier.emit('update', type);
    };
}

gulp.task('do-less', function() {
    return gulp.src('less/**/*.less', {
            base: 'less/'
        })
        .pipe(less({}))
        .pipe(prefix('last 2 versions', '> 5%'))
        .pipe(gulp.dest(path.join(BUILD_PATH, 'css')));
});
gulp.task('less', ['do-less'], getReadyTask('css'));

gulp.task('do-js-browserify', function() {
    var b = browserify({
        entries: './js/main.js',
        debug: true,
    });
    b.transform('reactify', {
        es6: true,
    });
    return b.bundle()
        .pipe(source('main-bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
            // .pipe(uglify())
            .on('error', gutil.log)
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(path.join(BUILD_PATH, 'js')));
});

gulp.task('js-browserify', ['do-js-browserify'], getReadyTask('js'));

gulp.task('restart-gulp', function() {
    console.log('restarting gulp...');
    process.exit(0);
});

var buildWintersmith = function() {
    var currCProc;
    var buildCallbacks = [];
    function _build() {
        var myCallbacks = buildCallbacks;
        buildCallbacks = [];
        var myProc = spawn('../node_modules/.bin/wintersmith', ['build'], {
            cwd: 'wintersmith/',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        myProc.once('close', function() {
            currCProc = null;
            if (buildCallbacks.length) {
                _build();
            }
            _.each(myCallbacks, function(callback) {
                callback();
            });
        });
        myProc.stdout.on('data', process.stdout.write.bind(process.stdout));
        myProc.stderr.on('data', process.stderr.write.bind(process.stderr));
        currCProc = myProc;
    }

    return function build(cb) {
        buildCallbacks.push(cb);
        if (!currCProc) {
            _build();
        }
    };
}();

gulp.task('do-build-wintersmith', function(cb) {
    buildWintersmith(function() {
        fs.copy('wintersmith/build/', BUILD_PATH, {
            clobber: true,
        }, function() {
            // Make all the /AAA.html files also available at /AAA
            glob(path.join(BUILD_PATH, '**/*.html'), {
                ignore: '**/index.html',
            }, function(err, matches) {
                async.each(matches, function(match, done) {
                    var newpath = match.replace(/\.html$/, '/index.html');
                    fs.copy(match, newpath, { clobber: true }, done);
                }, cb);
            });
        });
    });
});

gulp.task('build-wintersmith', ['do-build-wintersmith'], getReadyTask('html'));

gulp.task('build', ['build-wintersmith', 'js-browserify', 'less']);

var notifyFn;
gulp.task('serve', function() {
    var app = express();
    var server = http.createServer(app);
    fs.copySync('autoreload.js', path.join(BUILD_PATH, 'autoreload.js'));
    app.use(express.static(BUILD_PATH));
    var wss = new WebSocketServer({
        server: server,
        path: '/ws_autoreload',
    });
    wss.on('connection', function connection(ws) {
        var transmit = ws.send.bind(ws);
        updateNotifier.on('update', transmit);
        ws.once('close', function() {
            updateNotifier.removeListener('update', transmit);
        });
    });
    server.listen(parseFloat(process.env.PORT) || 8080);
});

gulp.task('watch-files', function() {
    restartOnException();
    gulp.watch('less/**/*', ['less']);
    gulp.watch('js/**/*', ['js-browserify']);
    gulp.watch('wintersmith/**/*', ['build-wintersmith']);
    gulp.watch(['./gulpfile.js', 'autoreload'], ['restart-gulp']);
});

gulp.task('clean', function(cb) {
    del([
        BUILD_PATH,
        'wintersmith/build/',
    ], cb);
});

gulp.task('watch', ['serve', 'build', 'watch-files']);
gulp.task('default', ['build']);
