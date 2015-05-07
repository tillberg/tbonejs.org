
var _ = require('lodash');

module.exports = function(env, cb) {

  // console.log(_.keys(env));

  function getDocPage(filename, opts) {
    // console.log('DocPage ' + filename, opts);
    var me = new env.plugins.MarkdownPage(filename, opts.metadata, opts.markdown);
    me.getFilename = function() {
      return filename;
    };
    // me.getView = function() {
    //   return function(env, locals, contents, templates, callback) {
    //     // console.log('getView', arguments);
    //     var error = null;
    //     var context = _.extend({}, locals, { page: me });
    //     var buffer = new Buffer(templates['docs.jade'].fn(context));
    //     callback(error, buffer);
    //   };
    // };
    me.metadata.template = 'docs.jade';
    return me;
  }

  env.registerGenerator('docs', function(contents, callback) {
    // console.log('contents', contents);
    var pages = _.reduce(contents.docs, function(agg, opts, filename) {
      var path = filename.replace(/\.md$/, '.html');
      agg[path] = getDocPage(path, opts);
      return agg;
    }, {});
    // console.log('pages', pages);
    callback(null, pages);
  });
  cb();
};
