var neo4j = require('node-neo4j');
var db = new neo4j('http://localhost:7474/');

var express = require('express');
var sanitizeHtml = require('sanitize-html');
var bodyParser = require('body-parser');

var router = express.Router();

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.use(function(req, res, next) {
    db.listAllLabels(function(err, result) {
        if (! err) {
            req.app.locals.labels = result;    
        }
        next();
    })  
});

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
                var relQuery = "MATCH (n)-[r]-(m) WHERE id(n)="+id+" RETURN type(r), m.name, id(m), id(startNode(r)), labels(m), id(r)";
                db.cypherQuery(relQuery, function(err, result) {
                    if (err) {
                        next();
                    }
                    result.data.forEach(function(row) {
                        var dir = (row[3] == id) ? 'out' : 'in'; 
                        req.node.relationships.push({type: row[0], id: row[5], nodeName: row[1], nodeId: row[2], labels: row[4], direction: dir});
                    });
                    next();
                })
            })
        } else {
            next(new Error("Sorry, node " + id + " not found."))
        }
    })
})


router.get('/relationships.json', function(req, res, next) {

    db.readRelationshipTypes(function(err, result) {
        if (err) {
            next(err);
        } else {
            var objects = result.map(function(row) { return {"type": row}; });
            console.log(JSON.stringify(objects));
            res.json(objects);
        }
    })

})


router.get('/labels.json', function(req, res, next) {

    db.listAllLabels(function(err, result) {
        if (err) {
            next(err);
        } else {
            var objects = result.map(function(row) { return {"name": row}; });
            console.log(JSON.stringify(objects));
            res.json(objects);
        }
    })

})

router.get('/nodeautocomplete.json', function(req, res, next) {
    var query = req.query.q;
   if (null != query) {
        var cypher = "MATCH (n) WHERE n.name =~ \"(?i).*" + sanitizeHtml(query) + ".*\" RETURN n.name, id(n)";
        console.log(cypher);
        db.cypherQuery(cypher, function(err, results) {
            if (err) {
                next(err);
            } else {
                var objects = results.data.map(function(row) { return {"name": row[0], "id": row[1]}; });
                console.log(JSON.stringify(objects));
                res.json(objects);
            }
        })
    } else {
        res.json([]);
    }
})

router.get('/search', function(req, res, next) { 
    
    {
  
    var label= (req.query.l) ? ":"+req.query.l : "";
  
    var cypher = "MATCH (n"+label+") WHERE n.name =~ \"(?i).*" + sanitizeHtml(req.query.q) + ".*\" RETURN id(n), labels(n), n";
    console.log(cypher);
    db.cypherQuery(cypher, function(err, result) {
        if (err) {
            next(err);
        } else {
            if (req.xhr) {
                res.json(result);
            }
            else {
                res.render('search', {result: result, 'SearchMessage': "Found " + result.data.length + " nodes."});
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
router.get('/edit/:node([0-9]+)', function(req, res) { 
  res.render('edit', {node: req.node});
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
router.post('/update/:id', function(req, res, next) { 
    
    var id = req.params.id;
    console.log("updating " +id);
    db.updateNode(id, req.body, function(err, result) {
        if (err) {
            next(err);
        } else {
            if (result) {
                res.status(200).end();
            } else {
                res.status(400).send("node " + id + " not found");
            }
        }
    })
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
    var query = "MATCH (n) WHERE id(n)=" + fromNodeId + " MERGE (to {name: '" + toNodeName + "'}) MERGE (n)" + relationship + "(to)  RETURN type(r), to.name, id(to), id(r) ";
    console.log(query);
    db.cypherQuery(query, function(err, result) { 
        if (err) {
            next(err);
        }
        console.log(result);
        var row = result.data[0];
        res.json({type: row[0],id: row[3], nodeName: row[1], nodeId: row[2], direction: direction});
        
    });
});

/**
 * Adds a label to a node
 * query string should contain a key-value pair {l: "NewLabel"}
 */
router.put('/label/:id', function(req, res, next) {
    var label = req.query.l;
    if (label) {
        db.addLabelsToNode(req.params.id, label, function(err, data) {
            if (err) {
                next(err);
            } else {
                if (data === true) {
                    res.status(200).end();
                } else {
                    res.status(400).json({error: data}).end();
                }
            }
        })
    }
});

router.delete('/rel/:id', function(req, res, next) {
   var id = req.params.id;
   db.deleteRelationship(id, function(err, result) {
        if (err) {
            next(err);
        } else {
            if (result === true) {
                res.status(200).end();
            } else {
                res.status(400).send("Error deleting relatinoship").end();
            }
        }
   });
});

/**
 * DELETE /node/:id
 * - html -> redirect with message
 * - json -> send message
 */
router.delete('/:id', function(req, res, next) {
    var id = req.params.id;
    console.log("Deleting node " + id);
    db.deleteNode(id, function(err, node) {
       if (err) {
           console.log(err);
           next(err);
       } else {
           if (node === true) {
               console.log("Successfully deleted node " + id);
               res.status(200).end();
           } else {
               console.log("Error deleting node " + id)
               res.status(400).send("Error deleting node " + id).end();
           }
       }
    });
});

module.exports = router;