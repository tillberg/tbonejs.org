;
$('.highlight .html').each(function () {
    var $highlight =  $(this);
    var $starts = $highlight.find('.nx');
    $starts.filter(function () {
        return !$(this).text().match(/_|each/);
    }).each(function () {
        var $start = $(this);
        if ($start.parent().is('.underscore')) { return; }
        var els = [this];
        $start.find('~ span').each(function () {
            if (!$(this).is('.nx') && $(this).text() !== '.') {
                return false;
            } else {
                els.push(this);
            }
        });
        var $wrapper = $('<span class="underscore"></span>');
        if ($start.prev().prev().is('.kd')) {
            $wrapper.addClass('closure');
        }
        $(els).wrapAll($wrapper);
    });
});

(function () {
    tbone.createModel('stapler').singleton();
    tbone('stapler.brand', 'Swingline');
    tbone.createView('input', function () {
        var $this = this.$el;
        var prop = this.$el.data().value;
        var interacting;
        tbone(function () {
            var value = tbone(prop);
            if (!interacting) {
                $this.val(value || '');
            }
            interacting = false;
        });
        function update() {
            interacting = true;
            tbone(prop, $this.val());
        }
        $this.keydown(update).keyup(update).change(update).blur(update);
    });
    tbone.createView('onMyDesk', function() {
        this.$('stapler').css('background', tbone('stapler.color'));
    });
    var timer;
    $('.example-1 button').click(function () {
        if (timer) { clearTimeout(timer); timer = null; }
        var choices = [
            'red', 'hotpink', '#f00', '#bada55', 'rgba(255, 0, 0, 1)',
            'aquamarine', 'hsl(0, 100%, 50%)'
        ];
        var choice = choices[Math.floor(choices.length * Math.random())];
        var typed = '';
        function another () {
            typed += choice.charAt(0);
            T('stapler.color', typed);
            choice = choice.substr(1);
            timer = choice ? setTimeout(another, 40 + 100 * Math.random()) : null;
        }
        another();
    });
    tbone.render($('[tbone]'));
    $('body').addClass('tbone-ready');
}());