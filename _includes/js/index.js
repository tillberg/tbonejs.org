;

window.demoCallbacks = {};

tbone.createView('example', function () {
    var self = this;
    function updateFragmentHeaderStyle () {
        var $this = $(this);
        var height = $this.children('section').outerHeight();
        var margin = (height / 2) - 13;// 13 is the width / 2
        $this.children('h3').css({
            width: height,
            marginLeft: -margin - 9,
            marginTop: margin
        });
    }
    self.$('fragment').each(updateFragmentHeaderStyle);
    self.query('reloadCount');
    self.$el.off('click');
    self.$el.on('click', 'a.update', function () {
        self.query('reloadCount', (self.query('reloadCount') || 0) + 1);
        return false;
    });
    self.$el.on('click', 'a.show_source', function () {
        T.toggle('showSource.' + self.query('name_safe'));
        return false;
    });
    T(function () {
        self.$('iframe').css(self.query('iframecss') || {});
        updateFragmentHeaderStyle.call(self.$('iframe').closest('fragment')[0]);
    });
    window.demoCallbacks[self.query('id')] = function (op, data) {
        if (op === 'init') {
            self.$('icon').removeClass('icon-refresh-animate');
            return {
                html: self.query('html'),
                css: self.query('css'),
                javascript: self.query('javascript')
            };
        } else if (op === 'setcss') {
            self.query('iframecss', data);
        }
    };
});

tbone.createView('demo', function () {
    this.$el.off('click').on('click', 'a.full-version', function () {
        T('showSource.' + T('currDemoSafeName'), true);
    });
});

T('showSource', tbone.models.localStorage.make({ key: 'showSource' }))

(function () {
    function highlightInlineJS(s) {
        return s.replace(/&lt;\%(-|=|@|)(.+?)\%&gt;/g, function (all, op, js) {
            // Strip HTML-highlighting from the JS
            js = $('<div>').html(js).text();
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
        var name_safe = name.replace(/\s/g, '_');
        var parts = {
            id: i,
            name: name,
            name_safe: name_safe
        };
        src.replace(/~(\w+)~|([^~]+)/g, function (all, newType, newContents) {
            if (newType) {
                currType = newType;
            } else {
                var contents = _.trim(newContents).replace(/scrpt/g, 'script');
                parts[currType] = contents;
                if (currType === 'html' && window.WRAP_EXAMPLE_HTML) {
                    contents = [
                        '<scr', 'ipt name="exampleView" type="text/tbone-tmpl">\n',
                        _.map(contents.split('\n'), function (line) {
                            return '    ' + line;
                        }).join('\n') , '\n',
                        '</scr', 'ipt>\n',
                        '<div tbone="tmpl exampleView"></div>'
                    ].join('');
                }
                var highlighted = hljs.highlightAuto(contents).value;
                if (currType === 'html') {
                    highlighted = highlightInlineJS(highlighted);
                }
                parts[currType + '_hl'] = highlighted;
            }
        });
        T.push('examples', parts);
        T('examplesByName.' + name, parts);
        T('examplesByName.' + name_safe, parts);
    });
}());
