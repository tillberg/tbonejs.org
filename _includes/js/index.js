;

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

(function () {
    $('script[type="text/example"]').each(function () {
        var $this = $(this);
        var src = _.trim($this.html());
        var currType;
        var parts = {};
        src.replace(/\[(\w+)\]|([^\[]+)/g, function (all, newType, newContents) {
            if (newType) {
                currType = newType;
            } else {
                parts[currType] = _.trim(newContents);
            }
        });
    });
}());
