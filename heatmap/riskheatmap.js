hideInfoPanel = function() {
		d3.select("#rightpanel").classed("on",false);
}

showInfoPanel = function() {
		d3.select("#rightpanel").classed("on",true);
}

clearInfoPanel = function() {
	d3.select("#itemName").node().innerText="";
	d3.select("#detailsLayer").select("*").remove();
}

// utility functions
getFirstWord = function (str) {
    if (str.indexOf(' ') === -1)
        return str;
    else {
        words=str.split(/\s+/)
        return _.first(words,5).join(' ');
    }
};

substringMatcher = function(strs) {
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

function isUrl(str) {
    try {
        new URL(str);
        return true;
    } catch (e) {
        return false;
    }
}

d3.json("risks.json", function(error, jsondata) {
    if ( error ){
        console.log(error);
    }

    // three.js initialization
	var camera, renderer, controls;
	var width = window.innerWidth, height = window.innerHeight;
	var container = d3.select('#container').node();

	// set up the scene components
	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 3000 );
	camera.position.x = 750;
	camera.position.y = 450;
	camera.position.z = 750;

	// add  controls
	controls = new THREE.OrbitControls( camera );
	controls.rotateSpeed = .5;
	controls.zoomSpeed = .5;
	controls.panSpeed = 0.1;
	controls.enableKeys=false;
	controls.addEventListener( 'change', render );

    // Cubes/sizes
	var boxWidth = 75;
	var boxHeight = 50;
	var boxDepth = 70;
    var squareSize = 75;

	// create the scene
	scene = new THREE.Scene();

	// track mouse clicks
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();

	// make the basic box
	var geometry = new THREE.BoxGeometry( boxWidth, boxHeight, boxDepth );

	// Lights
	var ambientLight = new THREE.AmbientLight( 0x404040);

	var light = new THREE.HemisphereLight( 0xffffbb, 0x080820, .5 );
	var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
	directionalLight.position.set( 0, 1, 0 );


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

    // handle the risk data
    // https://wiki.mozilla.org/Security/Standard_Levels
	var riskColors = [
		{name: 'maximum',  color: '#d04437'},
		{name: 'high',  color: '#ffd351'},
		{name: 'medium',  color: '#4a6785'},
		{name: 'low',  color: '#cccccc'},
		{name: 'none',  color: '#ffffff'},
		{name: 'unknown',  color: '#ffffff'},
    ];
    var defaultColors = d3.scale.category20c();
	var riskLabels =[];
    var riskScores= [];
    var riskScale;
	var risks=[];
    var names=[];
    var rows=[];
    var gridPositions=[];
    data=[];
    // debug
    //window.data=data;
    //window.jsondata=jsondata;

    // build the item selections
    // omit the 'indicator' detail in the pull down
    //riskSections= _.keys(_.omit(jsondata,'indicators'));
    // order the sections the way we want them to default
    riskSections =[ "services", "assets" ]

    var options = d3.select('#sections')
        .selectAll('option')
	    .data(riskSections).enter()
	    .append('option')
        .text(function (d) { return d; });

    resetScene=function(){
        // clear the grid
        gridPositions=[];
        // clear up the scene elements
        scene.remove.apply(scene, scene.children);
        // add the lights back
        scene.add( ambientLight );
        scene.add( light );
        scene.add( directionalLight );
        // reset our view
        controls.reset();
        clearInfoPanel();
        hideInfoPanel();
    }

	populateGrid=function(){
        // for each item, make a box and put it on the grid
        data.forEach(function(d,i){
            // figure out what the color of this box should be
            // start with a safe choice from the template
            riskColor = d3.hcl(defaultColors(i));

            //set the color according to the worse case risk name from our list of riskColors
            try {
                aColor=_.findWhere(riskColors, {name: d.label});
                if ( ! _.isUndefined(aColor)) {
                    riskColor=d3.hcl(aColor.color)
                }
            } catch(e){
                console.log(e)
            }

            //lighten by risk score
            scaleColor=riskColor.brighter(d.score);
            d.record.color=scaleColor.toString();

            //set the material using the color
            var material = new THREE.MeshPhongMaterial( { color: scaleColor.toString(),
                                                            opacity: .7,
                                                            transparent: true,
                                                            shading: THREE.SmoothShading
                                                            } );
            var cube = new THREE.Mesh(geometry,material);
            cube.record=d.record;
            cube.name=d.name;
            cube.score=d.score;
            cube.label=d.label;
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
    };

    setupGrid=function(){
        // figure out how big the underlying grid should be
        // to match out data
        // rows should be one more than the square root of the data length
        // since 2 rows holds 4 squares.
        // add one for asthetics to show the grid.
        rows = Math.floor(Math.sqrt(data.length))+1;
        // grid
        var grid = new THREE.GridHelper((squareSize * rows),rows, 0x0000ff, 0x808080 );
        scene.add( grid );

        // calc the positions on the grid in order of closest to farthest
        // for assigning boxes by their risk

        gridSize=squareSize*(rows/2);
        var maxZ = gridSize/squareSize;
        var maxX = gridSize/squareSize;
        var lastX = maxX;
        var lastZ = maxZ;
        // console.log(maxZ,maxX,lastX,lastZ);
        // add the starting point
        gridPositions.push({x:maxX,z:maxZ});
        for (var i = maxX-1; i > maxX*-1; i--) {
        // console.log('rows: ' + i)
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
    }

    clearFilters = function(){
        //run through the cubes and set opacity to viewable
        scene.children.forEach(function(element,index) {
            if (_.has(element,'record')) {
                element.material.opacity=0.7;
            }
        });
    }

    mapData=function(){
        // walk the data we have chosen and setup color ranges, map key elements, etc
        section = d3.select('#sections').property('value')
        data = _.map(jsondata[section],function(risk) {
            if ( section == 'services' ){
                risk.section=section;
                risklabel='unknown'
                if ( risk.highest_risk_impact ){
                    risklabel=risk.highest_risk_impact.toLowerCase().trim()
                }
                return {
                name: risk.name,
                record: risk,
                score: Number(Number(risk.score).toFixed()),
                label: risklabel
                };
            }else if (section == 'assets'){
                risk.section=section;
                return {
                    name: risk.asset_identifier,
                    record: risk,
                    score: risk.score,
                    label: 'unknown'
                }
            }else{
                return null;
            }

          });
        //data = _.filter(data, function(d){ return _.isObject(d)});
        // sort the data by risk score
        data=_.sortBy(data, 'score');

        // reset filters
        names=[];
        riskScores=[];
        data.forEach(function(d, i) {

            if ( names.indexOf(d.name)==-1) {
                names.push(d.name);
            }
            if ( riskScores.indexOf(d.score)==-1) {
                riskScores.push(d.score);
            }
        });
        //reset and hook up typeahead filters
        $('#nameFilter .typeahead').typeahead('destroy');
        d3.select('#btnClearCriteria').on('click')();
        d3.select('#btnFilter').node().textContent="Filter";
        $('#nameFilter .typeahead').typeahead({
            hint: true,
            highlight: true,
            minLength: 1
        },
        {
            name: 'names',
            source: substringMatcher(names)
        });
        //with the list of risk scores in the data,
        //setup a d3 scale to size the boxes on the heatmap accordingly.
        riskScale=d3.scale.linear()
            .domain([d3.min(riskScores),d3.max(riskScores)])
            .range([.5,10])

        resetScene();
        setupGrid();
        populateGrid();
    };


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
				//fill the details panel with key/values
                dTable = d3.select("#detailsLayer")
                .append("li")
                .append("table");

                dTable.append("thead")
                    .append("th")
                    .attr("colspan","5")
                    .html(target.record.name);

                tbody=dTable.append("tbody");
                _.pairs(target.record).forEach(function(d,i){
                    // console.log(d)
                    // don't display null values or minutia like id, color
                    // otherwise, just display key/value
                    if ( d[1] && ! _.contains(['id','color','masked','timestamp_utc'], d[0]) ){
                        var rows = tbody.append("tr");
                        var columns = rows.selectAll("td")
                            .data(d)
                            .enter().append("td")
                            .classed('firstUpper',true)
                            .html(function(d){
                                if ( isUrl(d) ){
                                    return '<a target="_blank" href="' + d + '">' + "Link</a>"

                                }else{
                                    return d;
                                }
                            });
                    }
                });
                // if section is 'service'
                // look for a matching asset group
                // for each asset in the asset group
                // make a sub section for the asset details
                if ( target.record.section == 'services' ){
                    assetgroup = _.where(jsondata.assetgroups,{"service_id": target.record.id});
                    console.log(assetgroup);
                    assetgroup.forEach(function(ag){
                        ag.assets.forEach(function(a){
                            console.log(a);
                            // find this asset
                            asset=_.where(jsondata.assets,{"id": a});
                            // for each, summarize the details
                            asset.forEach(function(a){
                                dTable = d3.select("#detailsLayer")
                                .append("li")
                                .append("table");

                                dTable.append("thead")
                                    .append("th")
                                    .attr("colspan","5")
                                    .html(a.asset_identifier);
                            indicators = _.where(jsondata.indicators,{"asset_id": a.id});
                            // call function to format indicators
                            console.log(indicators);

                            })
                        })

                    });

                } // end target services
                if ( target.record.section == 'assets' ){
                    indicators = _.where(jsondata.indicators,{"asset_id": target.record.id});
                    if ( indicators.length > 0 ){
                        // console.log(indicators);
                        indicators.forEach(function(indicator,index){
                            //add event_source "Mozilla Observatory" to Web compliance
                            if ( indicator.event_source_name == 'Mozilla Observatory' ) {
                                //for each host, summarize
                                dTable = d3.select("#detailsLayer")
                                .append("li")
                                .append("table");

                                dTable.append("thead")
                                    .append("th")
                                    .attr("colspan","5")
                                    .html(target.record.asset_identifier + ': Grade ' + indicator.details.grade);

                                tbody=dTable.append("tbody");
                                indicator.details.tests.forEach(function(detail,detail_index){
                                    var rows = tbody.append("tr");

                                    var columns = rows.selectAll("td")
                                        .data(_.pairs(detail))
                                        .enter().append("td")
                                        .html(function(d){return d[0] + ': ' + d[1];});
                                });
                            } // end Observatory
                            if ( indicator.event_source_name == 'scanapi' ) {
                                dTable = d3.select("#detailsLayer")
                                .append("li")
                                .append("table");

                                dTable.append("thead")
                                    .append("th")
                                    .attr("colspan","5")
                                    .html(target.record.asset_identifier);

                                tbody=dTable.append("tbody");
                                rows = tbody.append("tr");

                                var columns = rows.selectAll("td")
                                    .data(_.pairs(indicator.details))
                                    .enter().append("td")
                                    .html(function(d){return d[0] + ': ' + d[1];});
                            }//end scanapi
                        });
                    }
                } // end handling an asset double click
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
		});

	d3.selectAll("#btnFilter").on("click", function () {
		btn=d3.selectAll("#btnFilter").node();
		clearFilter=true;
		name=d3.selectAll("#name").node().value;
		//filtered currently?
        btnState=btn.textContent;
        if (btnState=='Filter off') {
			btn.textContent='Filter';
		} else if (btnState =='Filter') {
			btn.textContent='Filter off';
			clearFilter=false;
		}
		if (clearFilter) {
			clearFilters();
		}else{
			//run through the cubes and set opacity to non viewable
			scene.children.forEach(function(element,index,array) {
				if ( element.record != undefined) {
                    //it's a cube and we should set opacity
                    //console.log(element)

					//hide any cube where we don't match a filter, or the filtered field is undefined
					if (name.length >1
						&& ( _.isUndefined(element.name)
							|| element.name.indexOf(name) == -1)) {
						element.material.opacity=.001;
					}
				}
			});
		}
	});
    d3.select('#sections').on('change',mapData);
    //make it go
    animate();
    mapData();

});

document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('#rightPanelClose a').addEventListener('click', hideInfoPanel);
});