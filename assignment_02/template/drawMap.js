// drawMap.js — Choropleth map: Severe Accident Rate by German State
function drawMap(processedData, germanyGeo) {

    const mapData  = processedData.map;
    const coverage = processedData.coverage;

    const STATE_ISO_TO_CODE = {
        "DE-SH":"01","DE-HH":"02","DE-NI":"03","DE-HB":"04","DE-NW":"05",
        "DE-HE":"06","DE-RP":"07","DE-BW":"08","DE-BY":"09","DE-SL":"10",
        "DE-BE":"11","DE-BB":"12","DE-MV":"13","DE-SN":"14","DE-ST":"15","DE-TH":"16"
    };

    let selectedYear    = 2017;
    let selectedVehicle = "bike"; // "bike" | "motorcycle" | "both"

    const width  = 960;
    const height = 700;
    const margin = { top: 10, bottom: 20, left: 10, right: 10 };

    // ── Container ──────────────────────────────────────────────────────────
    const container = d3.select("#map-card")
        .append("div")
        .attr("id", "map-container")
        .style("font-family", "sans-serif")
        .style("max-width", width + "px")
        .style("margin", "0 auto");

    // ── Controls ───────────────────────────────────────────────────────────
    container.append("h2")
    .style("text-align", "center")
    .style("font-size", "18px")
    .style("font-weight", "700")
    .style("color", "#1a1a2e")
    .style("margin", "0 0 4px 0")
    .text("Bike & Motorcycle Accident Severity Across German States");

    container.append("p")
    .style("text-align", "center")
    .style("font-size", "13px")
    .style("color", "#444")
    .style("margin", "0 0 12px 0")
    .text("Use the slider and vehicle filter to explore. Click any state to filter Heatmap below");
    const controls = container.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "24px")
        .style("padding", "12px 0 16px 0")
        .style("flex-wrap", "wrap");
    

    // Year slider
    const sliderWrap = controls.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "10px");

    sliderWrap.append("label")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("color", "#444")
        .text("Year:");

    const yearLabel = sliderWrap.append("span")
        .style("font-size", "14px")
        .style("font-weight", "700")
        .style("color", "#1a1a2e")
        .style("min-width", "36px")
        .text(selectedYear);

    sliderWrap.append("input")
        .attr("type", "range")
        .attr("min", 2016)
        .attr("max", 2024)
        .attr("step", 1)
        .attr("value", selectedYear)
        .style("width", "220px")
        .style("cursor", "pointer")
        .on("input", function () {
            selectedYear = +this.value;
            yearLabel.text(selectedYear);
            updateMap();
        });

    // Vehicle buttons
    const btnWrap = controls.append("div")
        .style("display", "flex")
        .style("gap", "8px")
        .style("align-items", "center");

    btnWrap.append("label")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("color", "#444")
        .text("Vehicle:");

    const vehicleButtons = [
        { key: "bike",       label: "Bike" },
        { key: "motorcycle", label: "Motorcycle" },
        { key: "both",       label: "Both" }
    ];

    vehicleButtons.forEach(({ key, label }) => {
        btnWrap.append("button")
            .attr("id", "btn-" + key)
            .text(label)
            .style("padding", "6px 16px")
            .style("border", "2px solid " + (key === selectedVehicle ? "#1a1a2e" : "#ccc"))
            .style("border-radius", "20px")
            .style("cursor", "pointer")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .style("background", key === selectedVehicle ? "#1a1a2e" : "#fff")
            .style("color", key === selectedVehicle ? "#fff" : "#444")
            .style("transition", "all 0.2s")
            .on("click", function () {
                selectedVehicle = key;
                vehicleButtons.forEach(({ key: k }) => {
                    d3.select("#btn-" + k)
                        .style("background", k === key ? "#1a1a2e" : "#fff")
                        .style("color",      k === key ? "#fff"    : "#444")
                        .style("border-color", k === key ? "#1a1a2e" : "#ccc");
                });
                updateMap();
                window.heatmapSetVehicle(selectedVehicle);
            });
    });

    // ── SVG ────────────────────────────────────────────────────────────────
    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .style("background", "#faf9f6")
        

    const projection = d3.geoMercator().fitExtent(
        [[margin.left, margin.top], [width - margin.right, height - margin.bottom]],
        germanyGeo
    );
    const path = d3.geoPath(projection);

    // ── Color scale ────────────────────────────────────────────────────────
    const colorScale = d3.scaleSequential()
        .domain([0.05, 0.40])
        .interpolator(d3.interpolateOranges);

    const zoomG = svg.append("g").attr("id", "zoom-group");
svg.call(
    d3.zoom()
      .scaleExtent([1, 8])
      .filter(event => event.type === "wheel")   // ← only scroll-wheel zooms
      .on("zoom", e => {
          zoomG.attr("transform", e.transform);
      })
);

    // Base land
    zoomG.append("path")
        .datum(germanyGeo)
        .attr("d", path)
        .attr("fill", "#e8e4dc")
        .attr("stroke", "#bbb")
        .attr("stroke-width", 0.5);

    // State paths
    const statesG = zoomG.append("g").attr("id", "states");
    statesG.selectAll("path")
        .data(germanyGeo.features)
        .join("path")
        .attr("d", path)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.8)
        .attr("class", "state-path");

    // ── Tooltip ────────────────────────────────────────────────────────────
    const tooltip = d3.select("body").append("div")
        .style("position", "absolute")
        .style("background", "rgba(20,20,40,0.88)")
        .style("color", "#fff")
        .style("padding", "10px 14px")
        .style("border-radius", "8px")
        .style("font-size", "13px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("line-height", "1.7")
        .style("max-width", "210px")
        .style("z-index", 999);

    // ── Legend ─────────────────────────────────────────────────────────────
   // ── Legend ─────────────────────────────────────────────────────────────
const legendG = svg.append("g")
    .attr("transform", `translate(20, ${height - 180})`);

const legendWidth = 160, legendHeight = 12;
const defs = svg.append("defs");
const grad = defs.append("linearGradient").attr("id", "legend-grad");
grad.selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .join("stop")
    .attr("offset", d => d)
    .attr("stop-color", d => d3.interpolateOranges(d));

// Title
legendG.append("text").attr("x", 0).attr("y", -20)
    .style("font-size", "12px").style("font-weight", "700")
    .style("fill", "#222").text("Accident Severity Rate by State");

// Subtitle explanation
legendG.append("text").attr("x", 0).attr("y", -7)
    .style("font-size", "10px").style("fill", "#666")
    .text("% of accidents causing death or serious injury");

// Color bar
legendG.append("rect")
    .attr("width", legendWidth).attr("height", legendHeight).attr("rx", 3)
    .style("fill", "url(#legend-grad)")
    .style("stroke", "#ccc").style("stroke-width", 0.5);

// Tick marks at 5%, 20%, 40%
[{val: 0.05, label: "5%"}, {val: 0.225, label: "20%"}, {val: 0.40, label: "40%+"}].forEach(({val, label}) => {
    const x = ((val - 0.05) / (0.40 - 0.05)) * legendWidth;
    legendG.append("line")
        .attr("x1", x).attr("x2", x)
        .attr("y1", legendHeight).attr("y2", legendHeight + 4)
        .style("stroke", "#888").style("stroke-width", 1);
    legendG.append("text")
        .attr("x", x).attr("y", legendHeight + 14)
        .style("font-size", "10px").style("fill", "#444")
        .style("text-anchor", "middle").text(label);
});

// No data swatch
legendG.append("rect")
    .attr("x", 0).attr("y", legendHeight + 26)
    .attr("width", 14).attr("height", 14).attr("rx", 2)
    .style("fill", "#cccccc").style("stroke", "#aaa").style("stroke-width", 0.5);
legendG.append("text")
    .attr("x", 20).attr("y", legendHeight + 37)
    .style("font-size", "10px").style("fill", "#555")
    .text("No data available for selected year");
    // ── Data lookup ────────────────────────────────────────────────────────
    function getStateData(stateCode) {
        if (selectedVehicle === "both") {
            const bike = mapData.find(d => d.state === stateCode && d.year === selectedYear && d.vehicle === "bike");
            const moto = mapData.find(d => d.state === stateCode && d.year === selectedYear && d.vehicle === "motorcycle");
            const entries = [bike, moto].filter(Boolean);
            if (entries.length === 0) return null;
            const total  = entries.reduce((s, d) => s + (d.total  || 0), 0);
            const severe = entries.reduce((s, d) => s + (d.severe || 0), 0);
            return {
                state: stateCode,
                state_name: entries[0].state_name,
                year: selectedYear,
                vehicle: "bike + motorcycle",
                total,
                severe,
                severe_rate: total > 0 ? severe / total : 0
            };
        }
        return mapData.find(d =>
            d.state === stateCode &&
            d.year  === selectedYear &&
            d.vehicle === selectedVehicle
        ) || null;
    }

    function isCoverageMissing(code) {
        return coverage[code] && selectedYear < coverage[code];
    }

    // ── Update ─────────────────────────────────────────────────────────────
    function updateMap() {
        statesG.selectAll(".state-path")
            .transition().duration(300)
            .attr("fill", function (feature) {
                const iso  = feature.properties.id;
                const code = STATE_ISO_TO_CODE[iso];
                if (!code) return "#cccccc";
                if (isCoverageMissing(code)) return "#cccccc";
                const d = getStateData(code);
                if (!d || d.severe_rate == null) return "#cccccc";
                return colorScale(d.severe_rate);
            });

        statesG.selectAll(".state-path")
            .on("mouseover", function (event, feature) {
                const iso  = feature.properties.id;
                const code = STATE_ISO_TO_CODE[iso];
                const name = feature.properties.name || code || "Unknown";
                const missing = !code || isCoverageMissing(code);
                const d = code ? getStateData(code) : null;

                let html = `<strong>${name}</strong><br>`;
                if (missing || !d || d.severe_rate == null) {
                    html += `No data for ${selectedYear}`;
                } else {
                   const vehicleLabel = d.vehicle === "bike" ? "Bike"
    : d.vehicle === "motorcycle" ? "Motorcycle"
    : "Bike + Motorcycle";
html += `Year: ${selectedYear}<br>`;
html += `Vehicle: ${vehicleLabel}<br>`;
html += `Severity rate: <strong>${(d.severe_rate * 100).toFixed(1)}%</strong><br>`;
html += `Total accidents: ${d.total.toLocaleString()}<br>`;
html += `Serious/fatal accidents: ${d.severe.toLocaleString()}`;
                }

                tooltip.style("opacity", 1).html(html);
                if (!window._selectedMapState) {
                    d3.select(this)
                        .style("stroke", "#333")
                        .style("stroke-width", 2)
                        .style("opacity", 0.85);
                }
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", (event.pageX + 14) + "px")
                    .style("top",  (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.style("opacity", 0);
                if (!window._selectedMapState) {
                    d3.select(this)
                        .style("stroke", "#fff")
                        .style("stroke-width", 0.8)
                        .style("opacity", 1);
                }
            })
            .on("click", function(event, feature) {       
    const iso  = feature.properties.id;
    const code = STATE_ISO_TO_CODE[iso];
    const name = feature.properties.name || code;
    const current = window._selectedMapState;
    if (current === code) {
        window._selectedMapState = null;
        window.heatmapSetState(null, null);
        statesG.selectAll(".state-path").style("opacity", 1);
    } else {
        window._selectedMapState = code;
        window.heatmapSetState(code, name);
        statesG.selectAll(".state-path").style("opacity", d =>
            d.properties.id === iso ? 1 : 0.45
        );
    }
});
}

    updateMap();
}