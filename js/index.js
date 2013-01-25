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
    tbone.render($('[tbone]'));
    $('body').addClass('tbone-ready');
}());