var express = require('express');
var neocrud = require('./neocrud');
var path = require('path');
var app = express();

app.set('view engine', 'jade');
app.set('views', './views');

app.use(logRequests);
app.use("/node", neocrud);
app.use(express.static(path.resolve(__dirname, "client")));
app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);


function logRequests(req, res, next) { 
    // console.log(req.method + " " + req.originalUrl);   
    next();
}

function logErrors(err, req, res, next) {
    console.log("Inside logErrors");
    console.error(err);
    next(err);
}

function clientErrorHandler(err, req, res, next) {
    if (req.xhr) { 
        res.status(500).json({error: err.stack});
    } else {
        next(err);
    }
}

function errorHandler(err, req, res, next) { 
    res.status(500);
    res.render('error', {error: err});
}


app.listen(process.env.PORT, process.env.IP);
