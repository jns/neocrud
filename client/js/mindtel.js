var getNodeProperties = function(node) { 
	var result = {};
	for (var prop in node) { 
		if (-1 == ['_id', 'name', 'labels', 'relationships'].indexOf(prop) ) {
			result[prop] = node[prop];
		}
	}
	return result;
}
		
var populateSearch = function (searchResults) { 
    
	 $("#SearchResults").empty();
    if (searchResults) { 
	    $('#SearchMessage').text("Found " + searchResults.data.length + " results.");
        $.each(searchResults.data, function(i, row) { 
	        var node_id = row[0];
	        var node_labels = row[1];
	        var node_data = row[2];
	        var node_link = $("<a/>", {href: "/node/" + node_id}).append(node_data.name);
	        var td_name = $("<td/>").append(node_link);
	        $.each(node_labels, function(j, label) { 
		        var span = $("<span/>");
		        span.text(label);
		        span.addClass("label");
		        span.addClass("label-primary");
		        span.addClass("small");
		        td_name.append(span);
	        });
	        var td_row = $("<tr/>").append(td_name);
	        $("#SearchResults").append(td_row);
        });

    } else {
        $("#SearchMessage").text("Found 0 results.");
    }
  };

function deleteRelationship(id) {
	$.ajax('rel/'+id, {method: 'DELETE'}).done(function() {
		document.location.reload();
	}).fail(function(error) {
		alert(error.responseText);
	});
}

function primaryNodeId() {
	var nodeId =$('#nodeId');
	if (typeof nodeId != undefined) {
		return nodeId.html();
	} else {
		return undefined;
	}
}

function setProperty(nodeId, propertyName, propertyValue) {
	            
    var values = {};
    values.nodeId = nodeId;
    values.propertyName = propertyName;
    values.propertyValue = propertyValue;
    
    console.log(JSON.stringify(values));
    
    return $.post('/node/set', values);
}

	function labelize(element, forNode) {
		if ( typeof forNode == undefined) {
			return;
		}
		element.css('display', 'inline');
		var inp = $('<input class="contents hide" type="text" placeholder="label" />');
		var but = $('<input id="expander" type="button" value="+" />');
		var id = forNode;
		element.append(inp);
		element.append(but);
		
		but.click(function() {
			inp.toggleClass('hide expand');
		});
		
		inp.keypress(function(ev) {
			if (ev.keyCode==13) {
				var $this = $(this);
				var value = $this[0].value;
				$this[0].value = "";
				$this.toggleClass('hide expand');
				addLabel(id, value).done(function() {
					element.before( $('<span class="label label-primary small margin-10"/>').text( value ) );
				}).fail(function() {
					console.log(err);
				});
			}
		});
	}
function addLabel(id, label) {
	var query = "l="+encodeURIComponent(label);
	return $.ajax({url:'label/'+id+"?"+query,  method: "PUT"});
}

// constructs the suggestion engine
var nodecomplete = new Bloodhound({
	datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
	queryTokenizer: Bloodhound.tokenizers.whitespace,
	remote: 'nodeautocomplete.json?q=%QUERY'
});

var relationshipcomplete = new Bloodhound({
	datumTokenizer: Bloodhound.tokenizers.obj.whitespace('type'),
	queryTokenizer: Bloodhound.tokenizers.whitespace,
	prefetch: '/node/relationships.json'
});

var labelcomplete = new Bloodhound({
	datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
	queryTokenizer: Bloodhound.tokenizers.whitespace,
	prefetch: '/node/labels.json'
});

// kicks off the loading/processing of `local` and `prefetch`
nodecomplete.initialize();
relationshipcomplete.initialize();
labelcomplete.initialize();