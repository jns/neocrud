var neo4j = require('node-neo4j');
var db = new neo4j('http://localhost:7474/');

var express = require('express');
var sanitizeHtml = require('sanitize-html');
var bodyParser = require('body-parser');

var router = express.Router();

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.param('node', function(req, res, next, id) {
    
    console.log("Retrieving node " + id);
    
    db.readNode(id, function(err, node) {
        if (err) {
            next(err);
        }
        
        if (node) {
            req.node = node;
            req.node.labels = [];
            req.node.relationships = [];
            req.node.properties = function() { 	
                var result = [];
            	for (var prop in node) { 
            		if (-1 == ['_id', 'name', 'labels', 'relationships', 'properties'].indexOf(prop) ) {
            			result.push(prop);
            		}
            	}
	            return result; 
            };
            
            db.readLabels(id, function(err, labels) {
                if (err) {
                    next(err);
                }
                
                req.node.labels = labels;
                var relQuery = "MATCH (n)-[r]-(m) WHERE id(n)="+id+" RETURN type(r), m.name, id(m), id(startNode(r))";
                db.cypherQuery(relQuery, function(err, result) {
                    if (err) {
                        next();
                    }
                    result.data.forEach(function(row) {
                        var dir = (row[3] == id) ? 'out' : 'in'; 
                        req.node.relationships.push({type: row[0], nodeName: row[1], nodeId: row[2], direction: dir});
                    });
                    next();
                })
            })
        } else {
            next(new Error("Sorry, node " + id + " not found."))
        }
    })
})

router.get('/search', function(req, res) { 
    
    if (null == req.query.q) { 
        res.render('search');
    } else {
    
    var cypher = "MATCH (n) WHERE n.name =~ \"(?i).*" + sanitizeHtml(req.query.q) + ".*\" RETURN id(n), labels(n), n";
    console.log(cypher);
    db.cypherQuery(cypher, function(err, result) {
        if (err) {
            throw err;
        }
        else {
            if (req.xhr) {
                res.json(result);
            }
            else {
                res.render('search', {result: result});
            }
        }
    });
    }
});

/**
 * GET /node/:id
 *  html -> render show data
 *  json -> send node and relationships
 */
 router.get('/:node([0-9]+)', function(req, res) {
    if (req.xhr) {
        res.json(req.node);
    } else {
        res.render('show', {node: req.node});
    }
});

 
 /**
  * GET /node/new
  *   render new form
  */
router.get('/new', function(req, res) {
  res.render('new');
});

/**
 * GET /node/edit/:id
 *   render edit form
 */
router.get('/edit/:id', function(req, res) { 
  
});

/**
 * POST /node/create
 * html 
 *    success -> redirect to show
 *    fail -> render new 
 * json -> 
 *    success -> send data
 *    fail -> send errors
 */
router.post('/create', function(req, res, next) {
    var name = sanitizeHtml(req.body.name);
    var labels = req.body.labels.split(/[\s|,]/).filter(function(str) { return sanitizeHtml(str.trim()); });
    db.insertNode({name: name}, labels, function(err, node){
        if (err) {
            next(err);
        } else {
            console.log("Added node " + node.data);
            res.redirect(node._id);
        }
    });
});


/**
 * PUT /node/update/:id
 * html -> redirect to show
 * json -> return data with success/fail status and errors
 */
router.put('/update/:id', function(req, res, next) { 
    console.log(req.body);
});

/**
 * POST /node/set
 * json -> Set the property of a node
 */
router.post('/set', function(req, res, next) {
    
    console.log(req.body);
    var id = sanitizeHtml(req.body.nodeId);
    var prop = sanitizeHtml(req.body.propertyName);
    var val = req.body.propertyValue;
    if (! /^\[.*\]$/.exec(val)) {
        val = "'" + val + "'"; // Quote non-array types
    }
    
    if (-1 == ['name', 'labels', 'relationships', 'properties'].indexOf(prop)) {
        var cypher = "MATCH (n)  WHERE id(n)="+id + " SET n."+prop+"="+ val;
        console.log(cypher);
        db.cypherQuery(cypher, function(err, result) {
            if (err) {
                next(err);
            } else {      
                res.json({name: prop, value: val}).end();
            }
        })
    } else {
        next(new Error('Invalid property name: ' + prop));
    }
});

/**
 * POST createRelationship
 *   json 
 *     return 200 upon success
 *     return 400 upon error
 */
router.post('/createRelationship', function(req, res, next) {
    
    var relType = sanitizeHtml(req.body.relType);
    var toNodeName = sanitizeHtml(req.body.toNodeName);
    var fromNodeId = sanitizeHtml(req.body.fromNodeId);
    var direction = req.body.relDirection;
    var relationship = "-[r:" + relType + "]-";
    if (direction == "out") { 
        relationship = relationship + ">";   
    } else {
        relationship = "<" + relationship;
    }
    var query = "MATCH (n) WHERE id(n)=" + fromNodeId + " MERGE (to {name: '" + toNodeName + "'}) MERGE (n)" + relationship + "(to)  RETURN type(r), to.name, id(to) ";
    console.log(query);
    db.cypherQuery(query, function(err, result) { 
        if (err) {
            next(err);
        }
        console.log(result);
        var row = result.data[0];
        res.json({type: row[0], nodeName: row[1], nodeId: row[2], direction: direction});
        
    });
});

/**
 * DELETE /node/:id
 * - html -> redirect with message
 * - json -> send message
 */
router.delete('/:id');

module.exports = router;