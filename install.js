define(function(require, exports, module) {
    
module.exports = function(session, options){
    session.install({
        "name": "Nak",
        "description": "Fast file searches for Cloud9",
        "cwd": "~/.c9",
        "optional": true
    }, {
        "npm": "https://github.com/c9/nak/tarball/c9"
    });

    // Show the installation screen
    session.start();
};

});