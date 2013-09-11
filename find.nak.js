/**
 * File Finder module for the Cloud9 IDE that uses nak
 *
 * @copyright 2012, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = ["plugin", "preferences", "ext", "fs", "proc", "nodeapi"];
    main.provides = ["finder"];
    return main;

    function main(options, imports, register) {
        var Plugin   = imports.plugin;
        var c9       = imports.c9;
        var prefs    = imports.preferences;
        var proc     = imports.proc;
        var fs       = imports.fs;

        var PATH     = imports.nodeapi.path;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit   = plugin.getEmitter();
        
        var MAIN_IGNORE = "/.c9/.nakignore";
        var TEMPLATE    = require("text!./nakignore-template")
            + "\n" + (options.ignore || "");

        var IGNORE      = options.ignore;

        var NAK = options.nak || "~/.c9/node_modules/nak/bin/nak";

        function install(callback, progress){
            // Check if nak is already installed
            fs.exists(NAK, function(exists) {
                if (exists)
                    return callback();
            
                progress("Installing nak");
                        
                // Create node_modules
                fs.mkdirP("~/.c9/node_modules", function(){
                    
                    // Install nak
                    proc.spawn("npm", {
                        args : ["install", "nak"],
                        cwd  : "~/.c9"
                    }, function(err, process){
                        if (err) return callback(err);
                        
                        var success = false;
                        process.stderr.on("data", function(chunk){
                            progress(chunk, true, true);
                        });
                        
                        process.stdout.on("data", function(chunk){
                            success = success || chunk.match(/nak@[\d\.]+/);
                            progress(chunk, true);
                        });
                        
                        process.stdout.on("end", function(){
                            if (!success)
                                return callback(new Error("Could not install nak"));
                            
                            progress("Setting up nak ignore file");
                            
                            // Set up nakignore
                            fs.exists(MAIN_IGNORE, function(exists){
                                if (!exists) {
                                    fs.mkdir("/.c9", function(err){
                                        if (err) return callback(err);
                                        
                                        fs.writeFile(MAIN_IGNORE, TEMPLATE, function(err){
                                            callback(err);
                                        });
                                    });
                                }
                                else
                                    callback();
                            });
                        });
                    });
                });
            });
        }
        
        var loaded = false;
        function load(callback){
            if (loaded) return;
            loaded = true;
            
            prefs.add({
               "General" : {
                   position : 100,
                   "Find in Files" : {
                       position : 30,
                       "Ignore these files" : {
                           name      : "txtPref",
                           type      : "textarea",
                           width     : 150,
                           height    : 130,
                           rowheight : 155,
                           position  : 1000
                       }
                   }
               }
            }, plugin);
            
            prefs.on("draw", function(){
                var ta = plugin.getElement("txtPref").lastChild;
                
                ta.on("afterchange", function(e){
                    fs.writeFile(MAIN_IGNORE, "utf8", e.value, function(){});
                });
                
                fs.readFile(MAIN_IGNORE, function(err, data){
                    if (err)
                        data = TEMPLATE;
                    
                    ta.setValue(data);
                });
            }, plugin);
        }
        
        /***** Methods *****/
        
        function assembleFilelistCommand(options) {
            var args;
    
            args = ["-l"]; //, "-a", MAIN_IGNORE]; // -l = filenames only
            
            if (options.hidden)
                args.push("-H");
                
            if (options.maxdepth)
                args.push("-m", options.maxdepth);
                
            args.push(options.path);
    
            return args;
        }
    
        function assembleSearchCommand(options) {
            var args, query = options.query;
    
            if (!query)
                return;
    
            args = []; //"-a", MAIN_IGNORE];
    
            if (!options.casesensitive)
                args.push("-i");
    
            if (options.wholeword)
                args.push("-w");
    
            if (options.hidden)
                args.push("-H");
                
            if (!options.regexp)
                args.push("-q");
    
            var includes = [], excludes = [];
    
            if (options.pattern) {
                // strip whitespace, grab out exclusions
                options.pattern.split(",").forEach(function (p) {
                    // strip whitespace
                    p = p.replace(/\s*/g, "");
    
                    if (/^\-/.test(p))
                        excludes.push(p.substring(1));
                    else
                        includes.push(p);
                });
            }
                
            if (IGNORE)
                excludes.push(IGNORE);

            // wildcard handling will be done in nak
            if (includes.length)
                args.push("-G", includes.join(", "));

            if (excludes.length)
                args.push("--ignore", excludes.join(", "));
    
            args.push(query);
    
            if (options.replaceAll && options.replacement)
                args.push(options.replacement);
            
            args.push(options.path);
            
            return args;
        }
        
        function list(options, callback){
            options.uri  = options.path || "";
            options.path = PATH.join((options.base || ""), (options.path || ""));
            
            if (!options.path)
                return callback(new Error("Invalid Path"));
            
            var args = assembleFilelistCommand(options);
            if (!args)
                return callback(new Error("Invalid Arguments"));
            
            execute(args, function(err, results){
                callback(err, results && results.stream);
            });
        }
        
        function find(options, callback){
            options.uri  = options.path || "";
            options.path = PATH.join((options.base || ""), (options.path || ""));
            
            if (!options.path)
                return callback(new Error("Invalid Path"));
            
            var args = assembleSearchCommand(options);
            if (!args)
                return callback(new Error("Invalid Arguments"));
                
            // if (this.activeProcess)
            //     this.activeProcess.kill("SIGKILL");
                
            execute(args, function(err, results){
                callback(err, results && results.stream);
            });
        }
        
        function execute(args, callback){
            proc.spawn(NAK, {
                args: args
            }, function(err, process){
                if (err)
                    return callback(err);
                
                callback(null, { stream: process.stdout })
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("install", function(e){
            install(e.next, e.progress);
            return false;
        });
        
        plugin.on("load", function(){
            load();
        });
        
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Finder implementation using nak
         **/
        plugin.freezePublicAPI({
            /**
             * Retrieves a list of files and lines that match a string or pattern
             * @param {Object}
             options *   object:
             *   path           {String}  the path to search in (displayed in the results)
             *   base           {String}  the base path to search in (is not displayed in the results)
             *   query          {String}  the text or regexp to match the file contents with
             *   casesensitive  {Boolean} whether to match on case or not. Default is false;
             *   wholeword      {Boolean} whether to match the `query` as a whole word.
             *   hidden         {String}  include files starting with a dott. Defaults to false.
             *   regexp         {String}  whether the `query` is a regular expression.
             *   pattern        {String}  specify what files/dirs to include
             *      and exclude. Prefix the words with minus '-' to exclude.
             *   replaceAll     {Boolean} whether to replace the found matches
             *   replacement    {String}  the string to replace the found matches with
             * @param callback(err, results) {Function} called when the results come in
             *   err     {Error}
             *   results {String}
             */
            find : find,
            
            /**
             * Retrieves a list of files under a path
             * @param {Object}
             options *   object:
             *   path     {String}  the path to search in (displayed in the results)
             *   base     {String}  the base path to search in (is not displayed in the results)
             *   hidden   {Boolean} include files starting with a dott. Defaults to false.
             *   maxdepth {Number}  maximum amount of parents a file can have.
             * @param callback(err, results) {Function} called when the results come in
             *   err     {Error}
             *   results {Object}
             *     data      {String}
             *     count     {Number}
             *     filecount {Number}
             */
            list : list
        });
        
        register(null, {
            finder: plugin
        });
    }
});
