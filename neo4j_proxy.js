var request = require('request');
var stream = require('stream');
var express = require('express');
var router = express.Router();

var substitute = new stream.Transform();
substitute._transform = function(chunk, encoding, done) {
    try {
        var data = chunk.toString();
        var newData = data.replace("localhost:7474/", substitute.host);
        this.push(data);
        done();
    } catch (er) {
        this.emit(er);
    }
}

router.use(function(req, res, next) {
     substitute.host = req.hostname + req.baseUrl;
     console.log(req.path);
    var x = request('http://localhost:7474' + req.path);
    req.pipe(x);
    // x.pipe(substitute);
    // substitute.pipe(res);
    x.pipe(res);
    
})

module.exports = router;