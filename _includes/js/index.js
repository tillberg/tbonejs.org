;

(function () {
    return;
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

tbone.createView('example', function () {
    this.$('fragment').each(function () {
        var $this = $(this);
        var height = $this.children('pre').height();
        var margin = (height / 2) - 13;// 13 is the width / 2
        $this.children('h3').css({
            width: height,
            marginLeft: -margin,
            marginTop: margin
        });
    });
});

(function () {
    function highlightInlineJS(s) {
        return s.replace(/&lt;\%(-|=|@|)(.+?)\%&gt;/g, function (all, op, js) {
            return [
                '<span class="erb">',
                '&lt;%' + op,
                '</span>',
                '<span class="inline-js">',
                hljs.highlight('javascript', js).value,
                '</span>',
                '<span class="erb">',
                '%&gt;',
                '</span>'
            ].join('');
        });
    }

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
                var highlighted = hljs.highlightAuto(parts[currType]).value;
                if (currType === 'html') {
                    highlighted = highlightInlineJS(highlighted);
                }
                parts[currType + '_hl'] = highlighted;
            }
        });
        T.push('examples', parts);
    });
    $('body').addClass('tbone-ready');
    tbone.render($('[tbone]'));
}());
