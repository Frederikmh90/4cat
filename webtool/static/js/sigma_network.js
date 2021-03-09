var sigmaconfig = {
	defaultLabelColor: "#0e0e0e",
	defaultNodeColor: "#CE1B28",
	edgeColor: "default",
	defaultEdgeColor: "#FFA5AC",
	enableHovering: false,
	defaultLabelAlignment: "right",
	minEdgeSize: 0.1,
	maxEdgeSize: 1,
	minNodeSize: 2,
	maxNodeSize: 20,
	labelSize: "proportional",
	labelSizeRatio: 1,
	labelThreshold: 3,
	verbose: true
};

var fa2config = {
	worker: true,
	barnesHutOptimize: false,
	barnesHutTheta: 0.5,
	edgeWeightInfluence: 0,
	scalingRatio: 1,
	startingIterations: 10,
	iterationsPerRender: 10,
	strongGravityMode: false,
	slowDown: 10,
};

var animation_running = false;
var graph_manipulation_disabled = false;

var current_json;

function init_network(core_json) {

	create_slider(Object.keys(core_json).length);

	key = Object.keys(core_json)[0]

	render_new_network(core_json[key]);

	// Notify what model is visualised here
	$("#network-name-box").text(key);
}

function render_new_network(json) {

	//console.log(json)

	s = new sigma({
		graph: json,
		container: "graph-container",
		settings: sigmaconfig
	});

	// To render everything
	s.refresh();

}

function change_network(update_json) {
	/*
	Changes the network layout without rendering an entirely new graph.
	Also makes for nice transitions so graphs can be "animated".
	*/

	// Get data that's already in the graph
	var existing_nodes_ids = s.graph.nodes().map(value => value.id);

	// Keep track of the edges and nodes added to know what to remove afterwards
	var nodes_added = [];
	var edges_added = [];

	var restart_fa2 = false;

	// FA2 will have to be killed if we're changing the graph's nodes and edges
	if (s.isForceAtlas2Running) {
		var restart_fa2 = true;
		stop_force_atlas();
	}
	s.killForceAtlas2();

	// Loop through new nodes
	for (var i = 0; i < update_json["nodes"].length; i++) {

		node = update_json["nodes"][i];
		nodes_added.push(node["id"]);

		// If the node is not in the graph yet, add it!
		if (! existing_nodes_ids.includes(node["id"])) {
			s.graph.addNode({
				id: node["id"],
				size: node["size"],
				label: node["label"],
				x: (Math.random() * 20), // random between 0 and 20
				y: (Math.random() * 20)
			});
		}
		// If it's already in there, possibly change its attributes
		else {
			// Only size for now
			s.graph.nodes(node["id"]).size = parseFloat(node["size"]);
		}
	}

	// Clean nodes and edges that are not in the new network
	for (node_id of existing_nodes_ids) {
		if (! nodes_added.includes(node_id)) {
			delete_node_ids.push(node_id)
			s.graph.dropNode(node_id); // also removes edges!
		}
	}

	// Loop through new edges
	var existing_edges_ids = s.graph.edges().map(value => value.id);

	for (var i = 0; i < update_json["edges"].length; i++) {

		edge = update_json["edges"][i];
		edges_added.push(edge["id"]);

		// If the edge is not in the graph yet, add it!
		if (! existing_edges_ids.includes(edge["id"])) {
			s.graph.addEdge({
				id: edge["id"],
				label: edge["label"],
				size: edge["size"],
				source: edge["source"],
				target: edge["target"]
			});
		}
		// If it's already in there, change its attributes
		else {
			// Only size for now
			s.graph.edges(edge["id"]).size = parseFloat(edge["size"]);
		}
	}
	
	s.refresh();

	if (restart_fa2) {
		start_force_atlas();
	}
}

function min_degree_filter(min_degree) {
	/*
	Filters the json of the network for a minimum degree range
	(where degree refers to the amount of edges a node has)
	*/

	// FA2 will have to be killed if we're changing the graph's nodes and edges
	if (s.isForceAtlas2Running) {
		var restart_fa2 = true;
		stop_force_atlas();
	}
	s.killForceAtlas2();


	var min_degree = parseInt(min_degree);

	var index = $("#time-slider").val() - 1;
	var key = Object.keys(core_json)[index];
	var root_json = JSON.parse(JSON.stringify(core_json[key])); // Important: deep copy!
	
	// First we need to re-add the nodes and edges to know their original degree values.
	// e.g. necessary if we want to go from a min degree range of 20 to 3.
	var nodes_there = s.graph.nodes().map(value => value.id);
	var edges_there = s.graph.edges().map(value => value.id);
	for (n of root_json["nodes"]) {
		if (!nodes_there.includes(n.id)) {
			s.graph.addNode({
				id: n["id"],
				size: n["size"],
				label: n["label"],
				x: (Math.random() * 20),
				y: (Math.random() * 20)
			});
		}
	}
	for (e of root_json["edges"]) {
		if (!edges_there.includes(e.id)) {
			s.graph.addEdge({
				id: e["id"],
				label: e["label"],
				size: e["size"],
				source: e["source"],
				target: e["target"]
			});
		}
	}

	var nodes_to_drop = Array();

	s.graph.nodes().forEach(function(node){

		// Node is a reference to your node in the graph
		degree = s.graph.degree(node.id);
		
		if (degree < min_degree) {
			nodes_to_drop.push(node.id)
		}
	});

	for (node_id of nodes_to_drop) {
		s.graph.dropNode(node_id);
	}
	s.refresh();
}

function create_slider(length) {
	// Creates an HTML slider based on the amount of w2v models returned from the server
	// Remove the old slider if it exists

	// Hide the date change slider and animate buttons if there's only one model
	if (length < 2) {
		$("#slider-container").hide();
	}
	else {
		$("#time-slider").attr("max", length);
	}
}

function toggle_force_atlas() {
	/*
	Start/stop the ForceAtlas2 algorithm from running
	*/

	if (s.isForceAtlas2Running()) {
		$("#start-force").removeClass("running");
		$("#start-force > .button-text").text("Start ForceAtlas2");
		$("#start-force > i").addClass("invisible");
		s.stopForceAtlas2();
	}
	else {
		$("#start-force").addClass("running");
		$("#start-force > .button-text").text("Stop ForceAtlas2");
		$("#start-force > i").removeClass("invisible");
		s.startForceAtlas2(fa2config);
	}
}

function stop_force_atlas() {
	$("#start-force").removeClass("running");
	$("#start-force > .button-text").text("Start ForceAtlas2");
	$("#start-force > i").addClass("invisible");
	s.stopForceAtlas2();
}

function start_force_atlas() {
	$("#start-force").addClass("running");
	$("#start-force > .button-text").text("Stop ForceAtlas2");
	$("#start-force > i").removeClass("invisible");
	s.startForceAtlas2(fa2config);
}

function change_date(index) {
	/*
	Change the nodes in the graph on the basis of a new object
	*/

	$("#network-name-box").text(Object.keys(core_json)[index]);

	change_network(core_json[Object.keys(core_json)[index]]);
}

function start_animation(json, index) {
	/*
	Animate networks over time
	*/

	animation_running = true;
	graph_manipulation_disabled = true;

	$("#btn-animate-slider > i").removeClass("invisible");
	$("#btn-animate-slider > .button-text").text("Stop animation");

	date_amount = Object.keys(json).length;
	current_date = index;

	// Initiate new graphs every 3 seconds
	animate_network = setInterval(function() {

		// Trigger the slider to change
		current_date++;
		$("#time-slider").val(current_date)

		// Change the network
		change_date(current_date - 1)

		// Stop if we're at the last graph
		if (current_date >= date_amount) {
			stop_animation();
		}

		}, 3000);
	}

function stop_animation() {
	/*
	Stop the network animation
	*/

	animation_running = false;
	graph_manipulation_disabled = false;
	clearInterval(animate_network);
	$("#btn-animate-slider > i").addClass("invisible");
	$("#btn-animate-slider > .button-text").text("Start animation");
}

function change_graph_settings(e) {
	/*
	Change the graph settings on user input
	*/

	// Some content validation - make sure number inputs are actually numbers
	if (e.type == "number") {
		e_value = parseFloat(e.value);

		if (isNaN(e_value)) {
			$("#parameter-alert-box").text("Invalid value for " + e.name)
			setInterval(function() {
				$("#parameter-alert-box").text("")
			}, 5000);
			return
		}
	}

	/* Switch for various inputs */
	switch(e.name) {

		/* Force Atlas 2 settings */
		case "gravity":
		fa2config["gravity"] = e_value;
		break;

		case "strong-gravity":
		fa2config["strongGravityMode"] = e.checked;
		break;

		case "edge-weight-influence":
		fa2config["edgeWeightInfluence"] = e_value;
		break;

		case "scaling-ratio":
		fa2config["scalingRatio"] = e_value;
		break;

		case "linlog-mode":
		fa2config["linLogMode"] = e.checked;
		break;

		case "outbound-attraction-distribution":
		fa2config["outboundAttractionDistribution"] = e.checked;
		break;

		case "adjust-sizes":
		fa2config["adjustSizes"] = e.checked;
		break;

		case "barnes-hut-optimise":
		fa2config["barnesHutOptimize"] = e.checked;
		break;

		case "barnes-hut-theta":
		fa2config["barnesHutTheta"] = e_value;
		break;

		case "slow-down":
		fa2config["slowDown"] = e_value;
		
		/* Visual settings */

		/* labels */
		case "show-labels":
		s.settings("drawLabels", e.checked);
		break;

		case "label-size":
		s.settings("labelSizeRatio", e.value);
		break;

		case "label-size-type":
		if (e.checked) {
			s.settings("labelSize", "proportional");
		}
		else {
			s.settings("labelSize", "fixed");
		}
		break;

		case "label-threshold":
		s.settings("labelThreshold", e.value);
		break;

		case "label-colour":
		s.settings("defaultLabelColor", e.value);
		break;

		/* nodes and edges */
		case "min-degree":
		min_degree_filter(e.value)
		break;

		case "min-node-size":
		s.settings("minNodeSize", e_value);
		break;

		case "max-node-size":
		s.settings("maxNodeSize", e_value);
		break;

		case "min-edge-size":
		s.settings("minEdgeSize", e_value);
		break;

		case "min-edge-size":
		s.settings("minEdgeSize", e_value);
		break;

		case "node-colour":
		s.settings("defaultNodeColor", e.value);
		break;

		case "edge-colour":
		s.settings("defaultEdgeColor", e.value);
		break;

		default:
	}
	
	// Re-initialise
	s.configForceAtlas2(fa2config);
	s.refresh();

}

function disable_graph_manipulation() {
	/*
	Disable manipulating the graph, e.g. with edge sizes.
	*/
}

function save_to_svg() {
	/*
	Saves the graph to an SVG file.
	*/
	
	s.toSVG({
		labels: true,
		classes: false,
		data: true,
		download: true,
		filename: $("#file-name").val()
	});
}

/* Handlers */

// ForceAtlas2 toggle button
$("#start-force").on("click", function(){
	toggle_force_atlas();
});

// Update the network if the slider changes
$("#slider-container").on("change", "#time-slider", function(){
	if (animation_running) {
		stop_animation();
	}
	change_date((this.value - 1));
});

// Animate network animation
$("#slider-container").on("click", "#btn-animate-slider", function(){
	if (!animation_running) {
		var slider_value = $("#time-slider").val();
		start_animation(core_json, slider_value);
	}
	else {
		stop_animation();
	}
});

// Change network settings / looks
$(".parameter-input").on("change", function(){
	change_graph_settings(this);
});

// Save to csv button
$("#save-svg").on("click", function(){
	save_to_svg();
});