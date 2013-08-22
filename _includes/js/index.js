;

window.demoCallbacks = {};

tbone.createView('example', function () {
    var self = this;
    function updateFragmentHeaderStyle () {
        var $this = $(this);
        var height = $this.children('section').height();
        var margin = (height / 2) - 13;// 13 is the width / 2
        $this.children('h3').css({
            width: height,
            marginLeft: -margin - 8,
            marginTop: margin
        });
    }
    self.$('fragment').each(updateFragmentHeaderStyle);
    self.query('reloadCount');
    self.$el.on('click', 'a.update', function () {
        self.query('reloadCount', (self.query('reloadCount') || 0) + 1);
        return false;
    });
    window.demoCallbacks[self.query('id')] = function (op, data) {
        if (op === 'init') {
            self.$('icon').removeClass('icon-refresh-animate');
            return {
                html: self.query('html'),
                javascript: self.query('javascript')
            };
        } else if (op === 'setcss') {
            self.$('iframe').css(data);
            updateFragmentHeaderStyle.call(self.$('iframe').closest('fragment')[0]);
        }
    };
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

    $('script[type="text/example"]').each(function (i) {
        var $this = $(this);
        var src = _.trim($this.html());
        var currType;
        var name = $this.attr('name');
        var parts = {
            id: i,
            name: name,
            name_safe: name.replace(/\s/g, '_')
        };
        src.replace(/~(\w+)~|([^~]+)/g, function (all, newType, newContents) {
            if (newType) {
                currType = newType;
            } else {
                parts[currType] = _.trim(newContents).replace(/scrpt/g, 'script');
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
