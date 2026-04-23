// Draw map with German states
function drawMap(data, germanyGeo){

    //Convert German State ISO to code
    const STATE_ISO_TO_CODE = {
		"DE-SH": "01",
		"DE-HH": "02",
		"DE-NI": "03",
		"DE-HB": "04",
		"DE-NW": "05",
		"DE-HE": "06",
		"DE-RP": "07",
		"DE-BW": "08",
		"DE-BY": "09",
		"DE-SL": "10",
		"DE-BE": "11",
		"DE-BB": "12",
		"DE-MV": "13",
		"DE-SN": "14",
		"DE-ST": "15",
		"DE-TH": "16"
	};

    const headers = [
        "stateCode", "administrativeRegionCode", "districtCode", "municipalityCode", "year", "month", "hour", "weekday", 
        "severity", "accidentKind", "accidentType", "lightCondition", "roadSurfaceCondition", "involvesBicycle", "involvesPassengerCar", 
        "involvesPedestrian", "involvesMotorcycle", "involvesGoodsRoadVehicle", "involvesOther", "longitude", "latitude"
    ];
    
    const objdata = data.map(row =>
        Object.fromEntries(row.map((val, i) => [headers[i], val]))
    );

    console.log(objdata)

    let height = 850;
    let width = 1925;

    let svg;
    let transform = { x: 0, y: 0, k: 1 };
    const margin = { top: 10, bottom: 80, left: 10, right: 10 };

    let geoProjection = d3.geoMercator().fitExtent(
        [
            [margin.left, margin.top],
            [width - margin.right, height - margin.bottom],
        ],
        germanyGeo // Adjust to Germany map
    );

    let path = d3.geoPath(geoProjection);

    // Create the main SVG element
    svg = d3.select("main")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Draw background rectangle
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#8ab4f8");

    // Create SVG element for the map
    const mapGroup = svg.append("g")
        .attr("id", "map")

    // Draw the map land
    mapGroup.append("path")
        .attr("id", "land")
        .attr("d", path(germanyGeo))
        .attr("fill", "#a8dab5")
        .attr("stroke", "#8db697")
        .attr("stroke-width", 0.5 / transform.k)
        .attr("stroke-linejoin", "round");

    const data_g = svg.append("g").attr("id", "data");

    // Zoom event
    svg.call(d3
        .zoom()
        .scaleExtent([1 / 2, 8])
        .on("zoom", zoomed));

    function zoomed(event) {
        transform = event.transform;
        //update map
        svg.selectAll("#map").attr("transform","translate("+transform.x+","+transform.y+")scale("+transform.k+")");
        svg.selectAll("#data").attr("transform","translate("+transform.x+","+transform.y+")scale("+transform.k+")");
    }
}