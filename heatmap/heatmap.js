hideInfoPanel = function() {
		d3.select("#rightpanel").classed("on",false);
}

showInfoPanel = function() {
		d3.select("#rightpanel").classed("on",true);
}

clearInfoPanel = function() {
	d3.select("#serviceName").node().innerText="";
	d3.select("#assetsLayer").select("*").remove();
	d3.select("#rraLayer").select("*").remove();
	d3.select("#webCompliance").select("*").remove();
	d3.select("#webVulnerabilities").select("*").remove();
	d3.select("#osCompliance").select("*").remove();
	d3.select("#osVulnerabilities").select("*").remove();
	d3.select("#platformLayer").select("*").remove();
	d3.select("#threatLayer").select("*").remove();
}

d3.json("risks.json", function(error, jsondata) {
	console.log(error);

// https://wiki.mozilla.org/Security/Standard_Levels
	var riskColors = [
		{name: 'maximum',  color: '#d04437'},
		{name: 'high',  color: '#ffd351'},
		{name: 'medium',  color: '#4a6785'},
		{name: 'low',  color: '#cccccc'},
		{name: 'none',  color: '#ffffff'},
		{name: 'unknown',  color: '#ffffff'},
	];
	var riskLabels =[];
	var riskScores= [];
	var risks=[];
	var developers=[];
	var operators=[];
	var owners=[];
	var names=[];
	
	//get the list of risks returned.
	risks= jsondata.risks;

	var camera, renderer, controls;
	var width = window.innerWidth, height = window.innerHeight;
	var container = d3.select('#container').node();
	var body=d3.select('body');


	//set up the scene components
	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 3000 );
	camera.position.x = 750;
	camera.position.y = 450;
	camera.position.z = 750;

	//add  controls
	controls = new THREE.OrbitControls( camera );

	controls.rotateSpeed = .5;
	controls.zoomSpeed = .5;
	controls.panSpeed = 0.1;
	controls.enableKeys=false;

	//controls.noZoom = false;
	//controls.noPan = false;
	//controls.staticMoving = false;
	//controls.dynamicDampingFactor = 0.3;

//            controls.keys = [ 65, 83, 68 ];

	controls.addEventListener( 'change', render );
	//debug
	//window.controls=controls;
	//window.camera = camera;

	//create the scene
	scene = new THREE.Scene();

	//track mouse clicks
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();

	//utility functions
	getFirstWord = function (str) {
			if (str.indexOf(' ') === -1)
				return str;
			else {
				words=str.split(/\s+/)
				return _.first(words,5).join(' ');
			}
		};

	var substringMatcher = function(strs) {
		return function findMatches(q, cb) {
			var matches, substringRegex;

			// an array that will be populated with substring matches
			matches = [];

			// regex used to determine if a string contains the substring `q`
			substrRegex = new RegExp(q, 'i');

			// iterate through the pool of strings and for any string that
			// contains the substring `q`, add it to the `matches` array
			$.each(strs, function(i, str) {
				if (substrRegex.test(str)) {
				  matches.push(str);
				}
			});
			cb(matches);
		};
	};

	function toDegrees(rad) {
		return rad * (180/Math.PI);
	}

	//function to move the camera towards a specific object in a cool pan
	//http://stackoverflow.com/a/20558135
	function panToObject(obj) {
		clearInfoPanel();
		hideInfoPanel();
		//rotate the camera when it stops to slighty ahead and slightly looking down
		var rotateTween = new TWEEN.Tween( controls.target )
			.to( { x: obj.position.x, y: obj.position.y-100, z: obj.position.z-50 }, 2000 )
			.interpolation(TWEEN.Interpolation.CatmullRom)
			.easing( TWEEN.Easing.Quintic.InOut )
			.start();

		//move the camera to slight in front of the object.
		var goTween = new TWEEN.Tween( camera.position )
			.to( { x: obj.position.x, y: obj.position.y, z: obj.position.z + 10 }, 2000 )
			.interpolation(TWEEN.Interpolation.CatmullRom)
			.easing(TWEEN.Easing.Quintic.InOut)
			.onComplete(function(){showInfoPanel()})
			.start();
	}


	//walk the data we got (risks) and setup color ranges, map key elements, etc
	defaultColors = d3.scale.category20c();
	data = _.map(risks,function(risk) {
	  return {
		name: risk.rra.name,
		record: risk,
		score: Number(Number(risk.risk.median).toFixed()),
		label: risk.risk.median_label
	  };
	});

	//sort the data by risk score
	data=_.sortBy(data, 'score');
	//debug select top X records.
	//data=_.first(data,11);

	//setup the range of risk scores, owners, operators, developers
	//and set colors for each record.
	data.forEach(function(d, i) {

		if ( names.indexOf(d.record.rra.name)==-1) {
			names.push(d.record.rra.name);
		}
		if ( riskScores.indexOf(d.score * d.record.risk.data_classification)==-1) {
			riskScores.push(d.score * d.record.risk.data_classification);
		}
		if ( developers.indexOf(d.record.rra.rra_details.details.metadata.developer) ==-1) {
			developers.push(d.record.rra.rra_details.details.metadata.developer);
			//console.log('adding ' + d.record.rra.rra_details.details.metadata.developer )
		}
		if ( operators.indexOf(d.record.rra.rra_details.details.metadata.operator) ==-1) {
			operators.push(d.record.rra.rra_details.details.metadata.operator);
			//console.log('adding ' + d.record.rra.rra_details.details.metadata.operator )
		}
		if ( owners.indexOf(d.record.rra.rra_details.details.metadata.owner) ==-1) {
			owners.push(d.record.rra.rra_details.details.metadata.owner);
			//console.log('adding ' + d.record.rra.rra_details.details.metadata.owner )
		}
		if ( riskLabels.indexOf(d.record.risk.median_label) ==-1) {
			riskLabels.push(d.record.risk.median_label);
			//console.log('adding ' + d.record.risk.median_label );
		}

	});

	//hook up the typeahead filters
	$('#nameFilter .typeahead').typeahead({
	  hint: true,
	  highlight: true,
	  minLength: 1
	},
	{
	  name: 'names',
	  source: substringMatcher(names)
	});

	$('#ownerFilter .typeahead').typeahead({
	  hint: true,
	  highlight: true,
	  minLength: 1
	},
	{
	  name: 'owners',
	  source: substringMatcher(owners)
	});

	$('#operatorFilter .typeahead').typeahead({
	  hint: true,
	  highlight: true,
	  minLength: 1
	},
	{
	  name: 'operators',
	  source: substringMatcher(operators)
	});

	$('#developerFilter .typeahead').typeahead(null,
	{
	  name: 'developers',
	  source: substringMatcher(developers)
	});

	//debug
	//window.riskScores=riskScores;
	//window.developers=developers;
	//window.operators=operators;
	//window.owners=owners;
	//window.names=names;
	window.risks=risks;
	//with the list of risk scores in the data,
	//setup a d3 scale to size the boxes on the heatmap accordingly.
	riskScale=d3.scale.linear()
		.domain([d3.min(riskScores),d3.max(riskScores)])
		.range([.5,10])

	redness = d3.scale.linear()
		.domain([d3.min(riskScores),d3.max(riskScores)])
		.rangeRound([0, 255]);


	// Cubes/sizes
	var boxWidth = 75;
	var boxHeight = 50;
	var boxDepth = 70;
	var squareSize = 75;
	//rows should be one more than the square root of the data length
	//since 2 rows holds 4 squares.
	//add one for asthetics to show the grid.
	var rows = Math.floor(Math.sqrt(data.length))+1;

	//grid
	var grid = new THREE.GridHelper((squareSize * rows),rows, 0x0000ff, 0x808080 );
	scene.add( grid );

	//calc the positions on the grid in order of closest to farthest
	//for assigning boxes by their risk
	var gridPositions=[];
	// q1 x=10, z=10
	// q2 x=-9, z=10
	// q3 x=-9, z=-9
	// q4 x=10, z=-9
	//order the positions we will place the boxes
	// 10 to -9
	// 10 to -9
	//maxZ- lastX-1 = startPos
	//step through maxX-minX
	//set lastX==current column
	//decrease z until it equals lastX-1
	//increase x until it reaches maxX
	//next step
	//          1    3          5                7                      9                    11                        13
	//xpositions=[10,  9, 9, 10,  8, 8, 8, 9, 10,  7, 7, 7, 7, 8, 9, 10,  6,6,6,6,6,7,8,9,10,  5,5,5,5,5,5,6,7,8,9,10 ,  4,4,4,4,4,4,4,5,6,7,8,9,10]
	//zpositions=[10, 10, 9, 9,  10, 9, 8, 8, 8,  10, 9, 8, 7, 7, 7,  7,  10,9,8,7,6,6,6,6,6, 10,9,8,7,6,5,5,5,5,5, 5 , 10,9,8,7,6,5,4,4,4,4,4,4,4]
	gridSize=squareSize*(rows/2);
	var maxZ = gridSize/squareSize;
	var maxX = gridSize/squareSize;
	var lastX = maxX;
	var lastZ = maxZ;
	//console.log(maxZ,maxX,lastX,lastZ);
	//add the starting point
	gridPositions.push({x:maxX,z:maxZ});
	for (var i = maxX-1; i > maxX*-1; i--) {
	   //console.log('rows: ' + i)
	   lastX=i;

		for (var z=lastZ;z >lastX-1;z--){
			//console.log('in maxZ');
			var position={}
			position.x=i;
			position.z=z;
			gridPositions.push(position);
		}
		for (var x=lastX;x <=maxX;x++){
			//console.log('in maxX');
			var position={}
			position.x=x;
			position.z=z;
			gridPositions.push(position);
		}

		lastX--;
	}
	//debug
	//window.gridPositions=gridPositions;

	//make the basic box
	var geometry = new THREE.BoxGeometry( boxWidth, boxHeight, boxDepth );
	//var material = new THREE.MeshLambertMaterial( { color: 0xffffff, shading: THREE.FlatShading, overdraw: 0.5 } );

	//for each item, make a box and put it on the grid
	data.forEach(function(d,i){
		//figure out what the color of this box should be
		//start with a safe choice from the template
		riskColor = d3.hcl(defaultColors(i));

		//set the color according to the worse case risk name from our list of riskColors
		try {
			aColor=_.findWhere(riskColors, {name: d.record.risk.worst_case_label});
			if ( ! _.isUndefined(aColor)) {
				riskColor=d3.hcl(aColor.color)
			}
		} catch(e){
			console.log(e)
		}

		//various trials
		//scaleColor=d3.rgb(redness(d.score),redness(d.score),redness(d.score));
		//scaleColor=d3.rgb(redness(d.score),thisColor.rgb().g,thisColor.rgb().b);
		//console.log(redness(d.score * d.record.risk.data_classification),riskColor.rgb().g,thisColor.rgb().b);
		//scaleColor=d3.rgb(redness(d.score * d.record.risk.data_classification),riskColor.rgb().g,thisColor.rgb().b);

		//lighten by risk score (median * worstcase * data classification)
		scaleColor=riskColor.brighter(d.score * (d.record.risk.data_classification/8));
		//darken by data classificaiton
		scaleColor=scaleColor.darker(d.record.risk.data_classification);
		d.record.color=scaleColor.toString();

		//set the material using the color
		var material = new THREE.MeshPhongMaterial( { color: scaleColor.toString(),
														opacity: .7,
														transparent: true,
														shading: THREE.SmoothShading
														} );
		var cube = new THREE.Mesh(geometry,material);
		cube.record=d.record;
		cube.scale.y = riskScale(d.score);
		cube.position.y = (cube.scale.y * boxHeight)/2 ;
		cube.position.x = (gridPositions[i].x * squareSize) - boxWidth/2;
		cube.position.z = (gridPositions[i].z * squareSize) - boxDepth/2;

		//add a plain css element for the label/name of the box.
		var cubeLabel = document.createElement('div');
		cubeLabel.className='label';
		cubeLabel.textContent=getFirstWord(d.name);

		//position the label
		//var label = new THREE.CSS3DObject(labelDIV.node());
		var label = new THREE.CSS3DObject(cubeLabel);
		label.position.copy(cube.position);
		label.position.y=cube.scale.y*boxHeight
		label.rotateX(THREE.Math.degToRad(-90));

		scene.add(cube);
		scene.add(label);

	});
	//publish objects to the console for debugging
	//window.data = data;

	// Lights

	var ambientLight = new THREE.AmbientLight( 0x404040);
	scene.add( ambientLight );
	var light = new THREE.HemisphereLight( 0xffffbb, 0x080820, .5 );
	scene.add( light );
	var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
	directionalLight.position.set( 0, 1, 0 );
	scene.add( directionalLight );

	//renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer = new THREE.WebGLRenderer( { alpha: true ,
										  precision: 'highp',
										  premultipliedAlpha: false,
										  antialias: true,
										  stencil: false,
										  preserveDrawingBuffer: false,
										  depth: true
										  });
	renderer.setClearColor( 0xf0f0f0 );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	//css renderer for non webgl elements
	cssRenderer = new THREE.CSS3DRenderer();
	cssRenderer.setSize(window.innerWidth,window.innerHeight);
	cssRenderer.domElement.style.position = 'absolute';
	cssRenderer.domElement.style.top = 0;
	container.appendChild( cssRenderer.domElement )

	function onWindowResize() {

		camera.left = window.innerWidth / - 2;
		camera.right = window.innerWidth / 2;
		camera.top = window.innerHeight / 2;
		camera.bottom = window.innerHeight / - 2;

		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );
		cssRenderer.setSize( window.innerWidth, window.innerHeight );

	}

	function animate() {

		requestAnimationFrame( animate );
		controls.update();
		render();

	}

	function render() {

		TWEEN.update();
		renderer.render( scene, camera );
		cssRenderer.render(scene,camera);

	}

	function onMouseDblClick( event ) {
			event.preventDefault();
			mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
			mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;

			raycaster.setFromCamera( mouse, camera );

			var intersects = raycaster.intersectObjects( scene.children );

			if ( intersects.length > 0 ) {
				target=intersects[0].object;
				//debug
				window.target=target;

				//visual for selection
				target.material.color.setHex( Math.random() * 0xffffff );
				//set color back after we've finished zooming
				window.setTimeout(function(){
					target.material.color.setStyle(target.record.color);
				},2000);

				//pick a spot for the camera to pan into
				targetCamera = target.position.clone();
				targetCamera.setY(2 * boxHeight + target.scale.y * boxHeight);
				targetCamera.setZ(target.position.z + boxDepth);


				//make an invisible scene target for the camera
				var hitgeometry = new THREE.BoxGeometry( 0, 0, 0 );
				var hitmaterial = new THREE.MeshPhongMaterial( { color: 0x0000,
																opacity: .001,
																transparent: true,
																shading: THREE.SmoothShading
																} );
				var particle = new THREE.Mesh(hitgeometry,hitmaterial);
				particle.position.copy(targetCamera)
				particle.scale.x = particle.scale.y = 1;
				//particle.rotateOnAxis(new THREE.Vector3(0,1,0), -.70)
				scene.add( particle );
				panToObject(particle);

				clearInfoPanel();
				//fill the info panel with this service's data
				d3.select("#serviceName").node().innerText=target.record.rra.name;
				d3.select("#rraLayer")
				.append("ul")
				.classed('rraLayerList', true)
				.append("li")
				.html("Data: " + target.record.rra.default_data_classification)
				.append("li")
				.html('<a target="_blank" href="https://docs.google.com/spreadsheets/d/' +target.record.rra.rra_details.source + '">' + "RRA Doc</a>");

				_.pairs(target.record.rra.rra_details.details.metadata).forEach(function(d,i){
					if (d[1].length>0) {
						d3.select(".rraLayerList")
						.append("li")
						.classed('firstUpper',true)
						.text(d[0] + ": " + d[1]);
					}
				});
				//setup the sub panes
				//where the asset info will go
				d3.select("#osVulnerabilities")
				.append("ul")
				.classed('osVulnerabilitiesList',true);	

				d3.select("#osCompliance")
				.append("ul")
				.classed('osComplianceList',true);
				
				d3.select("#webCompliance")
				.append("ul")
				.classed('webComplianceRatings',true);

				d3.select("#webVulnerabilities")
				.append("ul")
				.classed('webVulnerabilityRatings',true);
				
				d3.select("#assetsLayer")
				.append("ul")
				.classed('assetsLayerList',true);				

				//for each asset making up a service,
				_.find(target.record.rra.asset_groups).assets.forEach(function(asset,asset_index){

					if (_.has(asset,"asset_identifier")) {
						d3.select(".assetsLayerList")
						.append("li")
						.classed('systemGroup',true)
						.text(asset.asset_identifier +': ' + asset.asset_type);
					};

					//for each indicator in this asset
					asset.indicators.forEach(function(indicator,index){

						//add event_source "MIG Compliance" to OS compliance
						if ( indicator.event_source == 'MIG compliance' ) {
							dTable = d3.select(".osComplianceList")
							.append("li")
							.append("table");

							dTable.append("thead")
								.append("th")
								.attr("colspan","5")
								.html(asset.asset_identifier);

							tbody=dTable.append("tbody");
							indicator.details.forEach(function(detail,details_index){
								var rows = tbody.append("tr");

								var columns = rows.selectAll("td")
									.data(_.pairs(detail))
									.enter().append("td")
									.html(function(d){return d[0] + ': ' + d[1];});
							});
						}//end MIG Compliance

						//add event_source "scanapi" to OS Vulns
						if ( indicator.event_source == 'scanapi' ) {
							dTable = d3.select(".osVulnerabilitiesList")
							.append("li")
							.append("table");

							dTable.append("thead")
								.append("th")
								.attr("colspan","5")
								.html(asset.asset_identifier);

							tbody=dTable.append("tbody");
							rows = tbody.append("tr");

							var columns = rows.selectAll("td")
								.data(_.pairs(indicator.details))
								.enter().append("td")
								.html(function(d){return d[0] + ': ' + d[1];});
						}//end scanapi							

						//add event_source "Mozilla Observatory" to Web compliance
						if ( indicator.event_source == 'Mozilla Observatory' ) {
							//for each host, summarize
							dTable = d3.select(".webComplianceRatings")
							.append("li")
							.append("table");

							dTable.append("thead")
								.append("th")
								.attr("colspan","5")
								.html(asset.asset_identifier + ': Grade ' + indicator.details.grade);

							tbody=dTable.append("tbody");
							indicator.details.tests.forEach(function(detail,detail_index){
								var rows = tbody.append("tr");

								var columns = rows.selectAll("td")
									.data(_.pairs(detail))
									.enter().append("td")
									.html(function(d){return d[0] + ': ' + d[1];});
							});
						}//end Observatory

						//add event_source "ZAP DAST scan" to: Web vulns
						if ( indicator.event_source == 'ZAP DAST scan' ) {
							//for each host, summarize
							dTable = d3.select(".webVulnerabilityRatings")
							.append("li")
							.append("table");

							dTable.append("thead")
								.append("th")
								.attr("colspan","5")
								.html(asset.asset_identifier + ': ZAP Findings ');

							tbody=dTable.append("tbody");
							indicator.details.forEach(function(detail,detail_index){
								var rows = tbody.append("tr");

								var columns = rows.selectAll("td")
									.data(_.pairs(detail))
									.enter().append("td")
									.html(function(d){return d[0] + ': ' + d[1];});
							});
						}//end ZAP DAST Scan
					}); //end indicators
				});	//end target assets for each
			} //end mouse intersected a box
		} //end onMouseDblClick


	function keyHandler(event) {
		event = event || window.event;
		if (event.keyCode == 27 || event.keyCode == 32 ) {
			//reset the scene to default position
			controls.reset();
			clearInfoPanel();
			hideInfoPanel();
		}
	}

	function disableControls(event) {
		controls.enabled=false;
	}

	function enableControls(event) {
		controls.enabled=true;
	}

	//add our event listeners
	window.addEventListener( 'resize', onWindowResize, false );
	document.addEventListener( 'dblclick', onMouseDblClick, false );
	document.addEventListener('keyup',keyHandler,false);

	//if the navigation/info panes are showing, disable the three.js scene controls
	//to allow mose movements.
	d3.selectAll("leftnav").node().addEventListener('mouseenter',disableControls,false);
	d3.selectAll("leftnav").node().addEventListener('mouseleave',enableControls,false);
	d3.selectAll("#rightpanel").node().addEventListener('mouseenter',disableControls,false);
	d3.selectAll("#rightpanel").node().addEventListener('mouseleave',enableControls,false);

	d3.selectAll("#btnClearCriteria").on("click",function(){
		d3.selectAll("#name").node().value="";
		d3.selectAll("#developer").node().value="";
		d3.selectAll("#owner").node().value="";
		d3.selectAll("#operator").node().value="";
		});

	d3.selectAll("#btnFilter").on("click", function () {
		btn=d3.selectAll("#btnFilter").node();
		clearFilter=true;
		name=d3.selectAll("#name").node().value;
		developer=d3.selectAll("#developer").node().value;
		owner=d3.selectAll("#owner").node().value;
		operator=d3.selectAll("#operator").node().value;
		//filtered currently?
		btnState=btn.textContent;
		if (btnState =='Filter') {
			btn.textContent='Filter off';
			clearFilter=false;
		}
		if (btnState=='Filter off') {
			btn.textContent='Filter';
			
		}
		if (clearFilter) {
			//run through the cubes and set opacity to viewable
			scene.children.forEach(function(element,index) {
				if (_.has(element,'record')) {
					element.material.opacity=0.7;
				}
			});
		}else{
			//run through the cubes and set opacity to non viewable
			window.scene.children.forEach(function(element,index,array) {
				if ( element.record != undefined) {
					//it's a cube and we should set opacity
					
					//hide any cube where we don't match a filter, or the filtered field is undefined
					if (name.length >1 
						&& ( _.isUndefined(element.record.rra.name)
							|| element.record.rra.name.indexOf(name) == -1)) {
						element.material.opacity=.001;
					}
					if ( developer.length >1 
						&& ( _.isUndefined(element.record.rra.rra_details.details.metadata.developer)
							  || element.record.rra.rra_details.details.metadata.developer.indexOf(developer) == -1 )){
						element.material.opacity=.001;
					}
					if ( owner.length > 1 
						&& ( _.isUndefined(element.record.rra.rra_details.details.metadata.owner)
							|| element.record.rra.rra_details.details.metadata.owner.indexOf(owner) == -1 )){
						element.material.opacity=.001;
					}
					if ( operator.length > 1 
						&& ( _.isUndefined(element.record.rra.rra_details.details.metadata.operator)
							|| element.record.rra.rra_details.details.metadata.operator.indexOf(operator) ==-1 )){
						element.material.opacity=.001;
					}
				}
			});
		}
	});

	//make it go
	animate();

});
	
document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#rightPanelClose a').addEventListener('click', hideInfoPanel);
});	