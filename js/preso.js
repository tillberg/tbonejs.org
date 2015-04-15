;

var _ = require('lodash');
var $ = require('jquery');
var React = require('react');

function gotoNextSlide () {
    var newSlideNumber = T('slideNumber') + 1;
    if (newSlideNumber < T('slides.length')) {
        T('location.hash', '#' + newSlideNumber);
    }
}

function gotoPreviousSlide () {
    var newSlideNumber = T('slideNumber') - 1;
    if (newSlideNumber >= 0) {
        T('location.hash', '#' + newSlideNumber);
    }
}

(function () {
    // var baseSlideView = tbone.createView('slideBase', {
    //     postReady: function () {
    //         var self = this;
    //         self.$el.addClass('slide-' + self.slideId);
    //         self.$('pre').each(function(i, e) {
    //             var $this = $(this);
    //             var orig = _.trim($this.html()).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    //             var lang = $this.data('language') || 'javascript';
    //             var highlighted = hljs.highlight(lang, orig).value;
    //             highlighted = highlighted.replace(/&amp;/g, '&');
    //             $this.empty();
    //             $('<code>').html(highlighted).appendTo($this);
    //         });
    //         T(function () {
    //             var reveal = T('reveal.' + self.slideId);
    //             if (reveal != null) {
    //                 var next = reveal + 1;
    //                 T('slideFullyRevealed.' + self.slideId, self.$('.reveal-' + next).length === 0);
    //             }
    //         });
    //     }
    // });
    // $('slide').each(function (i) {
    //     var $this = $(this);
    //     var src = _.trim($this.html());
    //     var currType = 'html';
    //     var name = 'slide_' + i;
    //     var parts = {
    //         id: i,
    //         name: name
    //     };
    //     src.replace(/~(\w+)~|([^~]+)/g, function (all, newType, newContents) {
    //         if (newType) {
    //             currType = newType;
    //         } else {
    //             parts[currType] = _.trim(newContents).replace(/scrpt/g, 'script');
    //         }
    //     });
    //     var readyFn = parts.javascript ? new Function(parts.javascript) : function () {};
    //     tbone.createView(name, baseSlideView, {
    //         slideId: i,
    //         ready: readyFn
    //     });
    //     tbone.addTemplate(name, parts.html);
    //     T.push('slides', parts);
    // }).remove();
}());

T('slideNumber', function () {
    return parseFloat((T('location.hash') || '#0').replace(/^#/, ''));
});

(function () {
    var delayedSlideNumberInitialized;
    T(function () {
        var newSlideNumber = T('slideNumber');
        if (newSlideNumber != null) {
            if (delayedSlideNumberInitialized) {
                setTimeout(function () {
                    T('delayedSlideNumber', newSlideNumber);
                }, 800);
            } else {
                T('delayedSlideNumber', newSlideNumber);
                delayedSlideNumberInitialized = true;
            }
        }
    });
}());

T('revealed', function () {
    return _.map(_.range(T('slides.length') || 0), function (i) {
        var num = T('reveal.' + i);
        return num == null ? 10 : num;
    });
});

T('loadedSlides', function () {
    var delayedSlideNumber = T('delayedSlideNumber');
    var slideNumber = T('slideNumber');
    if (delayedSlideNumber != null && slideNumber != null) {
        return _.reduce(T('slides') || [], function (memo, slide) {
            var distance = T('zoom') ? 2 : 1;
            memo[slide.id] = (
                slideNumber === slide.id ||
                Math.abs(delayedSlideNumber - slide.id) <= distance);
            return memo;
        }, {});
    } else {
        return {};
    }
});

T('alwaysShowSource', true); // force example source to be visible

$(document).on('keydown', function (e) {
    var key = e.keyCode;
    if (e.altKey || e.metaKey || e.shiftKey || e.ctrlKey) {
        return;
    }
    if (key === 38) { // up
        gotoPreviousSlide();
        return false;
    } else if (key === 40) { // down
        gotoNextSlide();
        return false;
    } else if (key === 82) { // r
        _.each(_.range(T('slides.length')), function (i) {
            T('reveal.' + i, 0);
        });
    } else if (key === 90) { // z
        T.toggle('zoom');
    } else if (key === 32) { // space or down
        if (!T('slideFullyRevealed.' + T('slideNumber')) && T('reveal.' + T('slideNumber')) != null) {
            T.increment('reveal.' + T('slideNumber'));
        } else if (key === 32) {
            gotoNextSlide();
        }
        return false;
    } else if (key === 38) { // up
        var curr = T('reveal.' + T('slideNumber'));
        if (curr != 0 && curr != null) {
            T.increment('reveal.' + T('slideNumber'), -1);
        }
        return false;
    }
});

var Preso = require('./react/Preso');

React.render(<Preso />, $('#presentation')[0]);

// tbone.createView('preso', function () {
//     var self = this;
//     var $slides = self.$el.children();
//     T(function () {
//         var width = T('screen.width');
//         var height = T('screen.height');
//         $slides.css({
//             width: width,
//             height: height
//         });
//         self.$el.css({
//             height: T('slides.length') * height,
//             width: width
//         });
//         T(function () {
//             var slideNumber = T('slideNumber') || 0;
//             self.$el.css('top', -height * slideNumber);
//         });
//     });
//     _.defer(function () {
//         self.$el.addClass('anim');
//     });
// });

T(function () {
    $('body').toggleClass('zoom', !!T('zoom'));
});

(function () {
    function update () {
        T('screen.width', $(window).width());
        T('screen.height', $(window).height());
    }
    $(window).bind('resize', update);
    function timer () {
        update();
        setTimeout(timer, 1000);
    }
    timer();
}());

T('location', tbone.models.location.make());
tbone.drain();
// tbone.render($('[tbone]'));
