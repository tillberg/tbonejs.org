;

(function () {
    $('slide').each(function (i) {
        var $this = $(this);
        var src = _.trim($this.html());
        var currType;
        var name = 'slide_' + i;
        var parts = {
            id: i,
            name: name
        };
        src.replace(/~(\w+)~|([^~]+)/g, function (all, newType, newContents) {
            if (newType) {
                currType = newType;
            } else {
                parts[currType] = _.trim(newContents).replace(/scrpt/g, 'script');
            }
        });
        if (parts.javascript) {
            tbone.createView(name, new Function(parts.javascript));
        }
        tbone.addTemplate(name, parts.html);
        T.push('slides', parts);
    });
}());

T('slideNumber', function () {
    return parseFloat((T('location.hash') || '#0').replace(/^#/, ''));
});

$(document).on('keydown', function (e) {
    var key = e.keyCode;
    if (key === 37) { // left
        var newSlideNumber = T('slideNumber') - 1;
        if (newSlideNumber >= 0) {
            T('location.hash', '#' + newSlideNumber);
        }
    } else if (key === 39) { // right
        var newSlideNumber = T('slideNumber') + 1;
        if (newSlideNumber < T('slides.length')) {
            T('location.hash', '#' + newSlideNumber);
        }
    } else if (key === 90) { // z
        T.toggle('zoom');
    }
});

tbone.createView('preso', function () {
    var self = this;
    var $slides = self.$('.slide');
    T(function () {
        var width = T('screen.width');
        var height = T('screen.height');
        $slides.css({
            width: width,
            height: height
        });
        T(function () {
            var slideNumber = T('slideNumber') || 0;
            $slides.each(function (i) {
                $(this).css('left', (i - slideNumber) * width);
            });
        });
    });
    T(function () {
        self.$el.toggleClass('zoom', !!T('zoom'));
    });
    _.defer(function () {
        $slides.addClass('anim');
    });
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
tbone.render($('[tbone]'));
