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