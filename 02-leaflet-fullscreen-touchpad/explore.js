	/**
	 * Default state
	 * Set initial state with request parm
	 */ 
	var stateObj = { 
		lat: 46.566414,
		lng: 2.4609375,
		zoom: 6,
		selectedPostId: -1
		};
	
	function getRequestParm(name) {
	   if(name=(new RegExp('[?&]'+encodeURIComponent(name)+'=([^&]*)')).exec(location.search)) {
	      return decodeURIComponent(name[1]);
	   }
	   else {
		   return false;
	   }
	}
	
	var viewRequest = getRequestParm('llz');
	if(viewRequest) {
		var splitViewRequest = viewRequest.split(',');
		stateObj.lat = splitViewRequest[0];
		stateObj.lng = splitViewRequest[1];
		stateObj.zoom = splitViewRequest[2];
	}
	
	var postIdRequest = getRequestParm('sel');
	if(postIdRequest) {
		stateObj.selectedPostId = postIdRequest;
	}

	/**
	 * Map creation, controls creation and global variable setting
	 */
	// Create map
	var map = new L.Map('mapCanvas', { 
		zoomControl: false
        });
	L.control.zoom({ position: 'topright'}).addTo(map);
	L.control.scale().addTo(map);
		
	// create the tile layer with correct attribution
	L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZnJhbmNlaW1hZ2UiLCJhIjoieXJhTmZkTSJ9.rR0uVaO6Wuls8PUTrQ1J6A', {
		maxZoom: 18,
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
			'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
			'Imagery © <a href="http://mapbox.com">Mapbox</a>',
		id: 'mapbox.streets'
	}).addTo(map);	
	
	map.setView(new L.LatLng(stateObj.lat, stateObj.lng), stateObj.zoom);

	// Popups
	var tooltipPopup = false;
	
	// Arrays of posts
	var postlist = []; // original dataset
	var markers = {};	// key: postId	
	var postlistToCenter = []; // posts sorted by distance to the center of the map
	var postlistByGlobalId = {}; // key: postId	
	
	// Templates
	var tooltipTpl = document.getElementById('tooltipTpl').innerHTML;
	
	// Marker icons
	var markerIcon = L.divIcon({ className : 'circle', iconSize : [ 12, 12 ]});
	var markerSelectedIcon = L.divIcon({ className : 'circle selected', iconSize : [ 12, 12 ]});

	
	// Load data
	$.ajax({
	    url: testdata_url,
	    //jsonpCallback: "processJSON",
	    jsonp: false,
	    dataType: "jsonp"
	}).done(function(data){
	});


	
	// Parse JSON input. Can be called at initial loading or by selecting an input file
	function processJSON(data) {
		postlist = data;
		markers = {};	// key: postId	
		postlistByGlobalId = {}; // key: postId	
		
		for (var i = 0; i < postlist.length; i++) {
			postlist[i].url = "https://www.youtube.com/watch?v=" + postlist[i].youtubeId;
			postlist[i].thumbnail = "https://i.ytimg.com/vi/" + postlist[i].youtubeId + "/hqdefault.jpg";
			var latlng = postlist[i].latlng.split(',');
			postlist[i].lat = latlng[0].trim(); 
			postlist[i].lng =latlng[1].trim();
			var m = L.marker([postlist[i].lat, postlist[i].lng], { icon: markerIcon });
			postlistByGlobalId[postlist[i].guid] = postlist[i];
			m.postId = postlist[i].guid;
			markers[postlist[i].guid] = m; 
			map.addLayer(m);
		}
		
		if(stateObj.selectedPostId != -1 && markers[stateObj.selectedPostId]) {
			map.panTo(markers[stateObj.selectedPostId].getLatLng());
			showTooltip(stateObj.selectedPostId);
			markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
			markers[stateObj.selectedPostId]._bringToFront();
		}
	}
	

	// Map event handlers
	function mapMoveEnd(e) {
		stateObj.lat = map.getCenter().lat.toFixed(6);
		stateObj.lng = map.getCenter().lng.toFixed(6);
		stateObj.zoom = map.getZoom();
		stateObj.selectedPostId = -1;
		
		refreshPostlistView();	
	}
	
	map.on('moveend', mapMoveEnd);
	
	map.on('movestart', function(e) {
		if(stateObj.selectedPostId != -1) {
			markers[stateObj.selectedPostId]._resetZIndex();
			markers[stateObj.selectedPostId].setIcon(markerIcon);
		}
		map.closePopup(tooltipPopup);
		tooltipPopup = false;
	});
	
	map.on('click', function(e) {
		if(stateObj.selectedPostId != -1) {
			if(tooltipPopup != false) {
				map.closePopup(tooltipPopup);
				tooltipPopup = false;
			}
			else {
				showTooltip(stateObj.selectedPostId);
			}
		}
	});
	
		
	// Refresh post listing on page load or when the map has moved
	function refreshPostlistView() {
		
		// Sort it
		postlistToCenter = postlist.sort(function (a, b) {
			a.distanceToCenter = map.distance(map.getCenter(), L.latLng(a.lat, a.lng));
			b.distanceToCenter = map.distance(map.getCenter(), L.latLng(b.lat, b.lng));
			if(a.distanceToCenter > b.distanceToCenter) return 1;
			if(a.distanceToCenter < b.distanceToCenter) return -1;
			return 0;
		});
		
		// is the nearest point to center near enough to popup a tooltip
		var centerDiameter = 30;
		var markerDiameter = 12;
		var centerPoint = map.latLngToContainerPoint(map.getCenter());
		var markerPoint = map.latLngToContainerPoint(markers[postlistToCenter[0].guid].getLatLng());
		var pixelsFromMarkerToCenter = Math.pow(Math.pow(centerPoint.y - markerPoint.y ,2) + Math.pow(centerPoint.x - markerPoint.x ,2), 1/2); // Pythagore
		
		if(pixelsFromMarkerToCenter < (centerDiameter/2 - markerDiameter/2)) {
			map.off('moveend', mapMoveEnd);
			map.panTo(markers[postlistToCenter[0].guid].getLatLng(), { duration: .25 });
			setTimeout(function(){ map.on('moveend', mapMoveEnd); }, 300);

			showTooltip(postlistToCenter[0].guid);
			markers[postlistToCenter[0].guid].setIcon(markerSelectedIcon);
			markers[postlistToCenter[0].guid]._bringToFront();
			stateObj.selectedPostId = postlistToCenter[0].guid;
			stateObj.lat = markers[postlistToCenter[0].guid].getLatLng().lat;
			stateObj.lng = markers[postlistToCenter[0].guid].getLatLng().lng;
		}
		
		updateHistory();
	}


	// Show tooltip of postId
	function showTooltip(postId) {
		tooltipPopup = new L.ResponsivePopup({ offset: new L.Point(20,20), closeButton: false, autoPan: false });		
		tooltipPopup.setContent(Mustache.render(tooltipTpl, postlistByGlobalId[postId]) );
		tooltipPopup.setLatLng(markers[postId].getLatLng());
		tooltipPopup.postId = postId;
		tooltipPopup.openOn(map);
		
		$("div.postContent").on("click", postClicked);
	}
	
	
	// Post div clicked
	function postClicked(e) {
		var postId = $(this).attr("data-postId");

		$(this).append("<div class='loading'>");

		// track if possible
		if(typeof ga == 'function') { 
			ga('send', 'event', {
			    eventCategory: 'Outbound Link',
			    eventAction: 'click',
			    eventLabel: postlistByGlobalId[postId].title,
			    hitCallback: function() {
			      window.location = postlistByGlobalId[postId].url;
			    }
			  });
		}
		else {
			window.location = postlistByGlobalId[postId].url;
		}
	}

	
	
	// Search actions (using geonames web services)
	$("#searchform").submit(function( event ) {
		event.preventDefault();
		var query = $("#search").val().trim();
		
		var zipcodePattern = /^(\d{5})?$/;
		
		var items = [];
		if(zipcodePattern.test(query)) {
			var url = "http://api.geonames.org/postalCodeSearchJSON?postalcode=" + query + "&country=FR&maxRows=10&username=franceimage";
			$.getJSON(url, function(data) {	
				if(data.postalCodes.length == 1) {
					var val = data.postalCodes[0];
					map.setView([val.lat, val.lng], 13);
				} else {
					$.each(data.postalCodes, function(key, val) {
						items.push( "<li class='resultItem'><a href='#'  data-lat='" + val.lat + "' data-lng='" + val.lng + "'>" + val.placeName + "</a></li>" );
					});
					populateResults(items);
				}
			});
		}
		else {
			var url = "http://api.geonames.org/searchJSON?fcode=ADM4&country=FR&name_equals=" + encodeURIComponent(query) + "&maxRows=10&lang=en&username=franceimage";
			$.getJSON(url, function(data) {	
				
				if(data.geonames.length == 1) {
					var val = data.geonames[0];
					map.setView([val.lat, val.lng], 13);
				} 
				
				if(data.geonames.length > 1) {
					$.each(data.geonames, function(key, val) {
						items.push( "<li class='resultItem'><a href='#' data-lat='" + val.lat + "' data-lng='" + val.lng + "'>" + val.name + " - " + val.adminName1 + "</a></li>" );
					});
					populateResults(items);
				} 
				
				if(data.geonames.length == 0) {
					var url = "http://api.geonames.org/searchJSON?country=FR&q=" + encodeURIComponent(query) + "&maxRows=10&lang=en&username=franceimage";
					$.getJSON(url, function(data) {	
						if(data.geonames.length == 1) {
							var val = data.geonames[0];
							map.setView([val.lat, val.lng], 13);
						} else {
							$.each(data.geonames, function(key, val) {
								items.push( "<li class='resultItem'><a href='#' data-lat='" + val.lat + "' data-lng='" + val.lng + "'>" + val.name + " - " + val.adminName1 + "</a></li>" );
							});
							populateResults(items);
						}
					});
				}
			});
		}
	
	
		function populateResults(items) {	
			$( "<ul/>", {
			    "class": "",
			    html: items.join( "" )
			  }).appendTo("#searchResults");
			
			$(".resultItem a").click(function(event) {
				event.stopPropagation();
				event.preventDefault();				

				$("#searchResults").html("");
				$("#infoPanel").hide();
				var lat = $(this).data("lat");
				var lng = $(this).data("lng");
				map.setView([lat, lng], 13);
			});
			
			$("#infoPanel").show();
		}
	});
	
	$("#search").bind("mouseup", function(e) {
		setTimeout(function() {
			if($("#search").val() == "") {
				$("#searchResults").html("");
				$("#infoPanel").hide();
			}
		}, 1);
	});
	
	$("#closeInfoPanel").click(function(event) {
		event.stopPropagation();
		event.preventDefault();				

		$("#searchResults").html("");
		$("#infoPanel").hide();
	});
	

	// Utilities
	function updateHistory() {
		// Update history
		var parms = "llz=" + stateObj.lat + "," + stateObj.lng + "," + stateObj.zoom;
		
		if(stateObj.selectedPostId != -1) {
			parms = parms + "&sel=" + stateObj.selectedPostId;
		}
				
		History.replaceState({}, document.title, "?" + parms);				
	}
	




	
	
	

	