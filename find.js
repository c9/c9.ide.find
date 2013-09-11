define(function(require, exports, module) {
    main.consumes = ["plugin", "fs", "finder", "util"];
    main.provides = ["find"];
    return main;

    function main(options, imports, register) {
        var fs       = imports.fs;
        var Plugin   = imports.plugin;
        var finder   = imports.finder;
        var util     = imports.util;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit   = plugin.getEmitter();
        
        plugin.__defineGetter__("basePath", function(){ return basePath; });
        
        var basePath   = options.basePath;
        var retrieving = false;
        var queue      = [];
        var cached, cacheTime;
        
        // var loaded = false;
        // function load(){
        //     if (loaded) return false;
        //     loaded = true;
        // }
        
        /***** Methods *****/
        
        function getFileList(options, callback){
            if (cached && !options.nocache 
              && new Date() - cacheTime < 60 * 60 * 1000)
                return callback(null, cached);
    
            queue.push([options, callback]);
            
            if (retrieving)
                return;
            
            if (!options.base)
                options.base = basePath;
    
            cached     = "";
            retrieving = true;
            
            finder.list(options, function(err, stream) {
                if (!err) {
                    cacheTime  = new Date();
                }
                retrieving = false;

                var needsBuffer = [];
                queue.forEach(function(iter){
                    if (err || !iter[0].buffer)
                        iter[1](err, stream) 
                    else
                        needsBuffer.push(iter[1]);
                });
                queue = [];
                
                if (err || !needsBuffer) return;
                
                cached = "";
                stream.on("data", function(lines){
                    cached += lines;
                });
                stream.on("end", function(){
                    if (options.base && options.base != "/") {
                        var rgx = new RegExp(util.escapeRegExp(options.base), "g");
                        cached  = cached.replace(rgx, "").replace(/\\/g, "/")
                    }
                    
                    needsBuffer.forEach(function(cb){
                        cb(null, cached);
                    });
                });
            });
        }
        
        function findFiles(options, callback){
            if (!options.base)
                options.base = basePath;
            
            finder.find(options, function(err, stream){
                if (err || !options.buffer)
                    return callback(err, stream);
                
                var buffer = "";
                stream.on("data", function(lines){
                    buffer += lines;
                });
                stream.on("end", function(){
                    if (options.base && options.base != "/") {
                        var rgx = new RegExp(util.escapeRegExp(options.base), "g");
                        buffer = buffer.replace(rgx, "").replace(/\\/g, "/");
                    }
                    callback(null, buffer);
                });
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            // load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Finds or lists files and/or lines based on their filename or contents
         **/
        plugin.freezePublicAPI({
            /**
             * Retrieves a list of files and lines that match a string or pattern
             * This method tries to do intelligent caching by hooking into the
             * fs and watcher.
             * @param {Object}
             options * @param {Object} e
             *   path           {String}  the path to search in (displayed in the results). Defaults to "".
             *   base           {String}  the base path to search in (is not displayed in the results when buffered). Defaults to the fs root.
             *   query          {String}  the text or regexp to match the file contents with
             *   casesensitive  {Boolean} whether to match on case or not. Default is false;
             *   wholeword      {Boolean} whether to match the `pattern` as a whole word.
             *   hidden         {String}  include files starting with a dott. Defaults to false.
             *   regexp         {String}  whether the `pattern` is a regular expression.
             *   pattern        {String}  specify what files/dirs to include 
             *      and exclude. Prefix the words with minus '-' to exclude.
             *   replaceAll     {Boolean} whether to replace the found matches
             *   replacement    {String}  the string to replace the found matches with
             *   buffer         {Boolean} whether to buffer the request. This changes 
             *      what is returned in the callback to a string instead of a stream.
             * @param callback(err, results) {Function} called when the results come in
             *   err     {Error}
             *   results {Stream|String}
             */
            findFiles : findFiles,
            
            /**
             * Retrieves a list of files under a path
             * @param {Object}
             options * @param {Object} e
             *   path     {String}  the path to search in (displayed in the results). Defaults to "".
             *   base     {String}  the base path to search in (is not displayed in the results when buffered). Defaults to the fs root.
             *   hidden   {Boolean} include files starting with a dott. Defaults to false.
             *   maxdepth {Number}  maximum amount of parents a file can have.
             *   nocache  {Boolean} ignore the cache
             *   buffer   {Boolean} whether to buffer the request. This changes 
             *      what is returned in the callback to a string instead of a stream.
             * @param callback(err, results) {Function} called when the results come in
             *   err     {Error}
             *   results {Stream|String}
             */
            getFileList : getFileList
        });
        
        register(null, {
            find: plugin
        });
    }
});