'use strict';

var _ = require('lodash');
var gulp = require('gulp');
var gutil = require('gulp-util');
// var react = require('gulp-react');
var del = require('del');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
// var request = require('request');

var fs = require('fs-extra');

var BUILD_PATH = '_tbonejsorg';

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

function getReadyTask(type) {
    return function() {
        console.log('dev-ready ' + type);
    };
}

gulp.task('do-js-browserify', function() {
    var b = browserify();
    b.add('src/contents/js/main.js');
    b.transform('reactify', {
        es6: true
    });
    return b.bundle()
        .on('error', function(err) {
            gutil.log(err.message);
            this.emit('end');
        })
        .pipe(source('main-bundle.js'))
        .pipe(gulp.dest('src/contents/build/'));
});

gulp.task('js-browserify', ['do-js-browserify'], getReadyTask('browserify'));

gulp.task('restart-gulp', function() {
    console.log('restarting gulp...');
    restartServer();
    process.exit(0);
});

var buildWintersmith = function() {
    var currCProc;
    var buildCallbacks = [];
    function _build() {
        var myCallbacks = buildCallbacks;
        buildCallbacks = [];
        var myProc = spawn('../node_modules/.bin/wintersmith', ['build'], {
            cwd: 'src/',
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
        fs.copy('src/build/', BUILD_PATH, {
            clobber: true,
        }, cb);
    });
});

gulp.task('build-wintersmith', ['do-build-wintersmith'], getReadyTask('html'));

gulp.task('build', ['build-wintersmith']);

gulp.task('watch-files', function() {
    restartOnException();
    gulp.watch('src/contents/css/', ['css-process-notify']);
    // gulp.watch('src/', ['css-process-notify']);
    gulp.watch(['./gulpfile.js'], ['restart-gulp']);
});

gulp.task('clean', function(cb) {
    del([BUILD_PATH], cb);
});

gulp.task('watch', ['serve', 'build', 'watch-files']);
gulp.task('default', ['build']);
