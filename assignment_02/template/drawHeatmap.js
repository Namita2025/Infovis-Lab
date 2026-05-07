// drawHeatmap.js — Hourly Severity Pattern Heatmap
function drawHeatmap(processedData) {

    const LIGHT_LABELS = {
        0: "Daylight",
        1: "Dusk / Dawn",
        2: "Dark (unlit)"
    };
    const LIGHT_ORDER = [0, 1, 2];

    let selectedVehicle = "bike";
    let selectedState   = null;

    const margin = { top: 60, right: 30, bottom: 60, left: 130 };
    const width  = 900 - margin.left - margin.right;
    const height = 280 - margin.top  - margin.bottom;

    // ── Container ──────────────────────────────────────────────────────────
    const container = d3.select("#heatmap-card")
        .append("div")
        .attr("id", "heatmap-container")
        .style("font-family", "sans-serif")
        .style("max-width", "960px")
        .style("margin", "32px auto 0 auto");

    // Title
    const titleEl = container.append("h2")
        .attr("id", "heatmap-title")
        .style("text-align", "center")
        .style("font-size", "17px")
        .style("font-weight", "700")
        .style("color", "#1a1a2e")
        .style("margin", "0 0 2px 0")
        .text("Hourly Accident Severity by Light Condition — All Germany");

    container.append("p")
        .style("text-align", "center")
        .style("font-size", "12px")
        .style("color", "#888")
        .style("margin", "0 0 10px 0")
        .text("Click a state on the map above to filter · Darker cells = higher severity rate");

    // ── SVG ────────────────────────────────────────────────────────────────
    const svg = container.append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .style("display", "block")
        .style("margin", "0 auto");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const hours = d3.range(0, 24);
    const xScale = d3.scaleBand().domain(hours).range([0, width]).padding(0.05);
    const yScale = d3.scaleBand().domain(LIGHT_ORDER).range([0, height]).padding(0.05);

    const colorScale = d3.scaleSequential()
        .domain([0, 0.45])
        .interpolator(d3.interpolateOranges);

    // Axes
    g.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(h => h + ":00"))
        .selectAll("text")
        .style("font-size", "10px")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    g.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => LIGHT_LABELS[d]))
        .selectAll("text")
        .style("font-size", "11px");

    // X axis label
    svg.append("text")
        .attr("x", margin.left + width / 2)
        .attr("y", margin.top + height + 56)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("Hour of Day");

    // Cells group
    const cellsG = g.append("g").attr("id", "hm-cells");

    // Tooltip
    const tooltip = d3.select("body").select("#hm-tooltip").node()
        ? d3.select("body").select("#hm-tooltip")
        : d3.select("body").append("div")
            .attr("id", "hm-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(20,20,40,0.88)")
            .style("color", "#fff")
            .style("padding", "8px 12px")
            .style("border-radius", "8px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("line-height", "1.7")
            .style("z-index", 999);

    // ── Legend ─────────────────────────────────────────────────────────────
    const legendW = 160;
    const legendG = svg.append("g")
        .attr("transform", `translate(${margin.left + width / 2 - legendW / 2}, 8)`);

    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "hm-legend-grad");
    grad.selectAll("stop")
        .data(d3.range(0, 1.01, 0.1))
        .join("stop")
        .attr("offset", d => d)
        .attr("stop-color", d => d3.interpolateOranges(d));

    legendG.append("rect")
        .attr("width", legendW).attr("height", 10).attr("rx", 2)
        .style("fill", "url(#hm-legend-grad)");

    legendG.append("text").attr("x", 0).attr("y", 22)
        .style("font-size", "10px").style("fill", "#555").text("Low severity");
    legendG.append("text").attr("x", legendW).attr("y", 22)
        .style("font-size", "10px").style("fill", "#555")
        .style("text-anchor", "end").text("High severity");

    // ── Data helper ────────────────────────────────────────────────────────
    function getFilteredData() {
        let data = processedData.hour;

        if (selectedState) {
            data = data.filter(d => d.state === selectedState);
        }

        if (selectedVehicle === "both") {
            const merged = {};
            data.forEach(d => {
                const key = `${d.hour}_${d.light}`;
                if (!merged[key]) merged[key] = { hour: d.hour, light: d.light, total: 0, severe: 0 };
                merged[key].total  += d.total;
                merged[key].severe += d.severe;
            });
            return Object.values(merged).map(d => ({
                ...d,
                severe_rate: d.total > 0 ? d.severe / d.total : 0
            }));
        }

        return data.filter(d => d.vehicle === selectedVehicle);
    }

    // ── Update ─────────────────────────────────────────────────────────────
    function updateHeatmap() {
        const data = getFilteredData();

        const lookup = {};
        data.forEach(d => { lookup[`${d.hour}_${d.light}`] = d; });

        const allCells = [];
        for (const light of LIGHT_ORDER) {
            for (const hour of hours) {
                allCells.push({ hour, light, entry: lookup[`${hour}_${light}`] || null });
            }
        }

        cellsG.selectAll(".hm-cell").data(allCells, d => `${d.hour}_${d.light}`)
            .join(
                enter => enter.append("rect")
                    .attr("class", "hm-cell")
                    .attr("x", d => xScale(d.hour))
                    .attr("y", d => yScale(d.light))
                    .attr("width",  xScale.bandwidth())
                    .attr("height", yScale.bandwidth())
                    .attr("rx", 2)
                    .style("fill", d => d.entry ? colorScale(d.entry.severe_rate) : "#e0ddd8")
                    .style("opacity", 0)
                    .call(enter => enter.transition().duration(400).style("opacity", 1)),
                update => update.transition().duration(400)
                    .style("fill", d => d.entry ? colorScale(d.entry.severe_rate) : "#e0ddd8"),
                exit => exit.remove()
            )
            .on("mouseover", function(event, d) {
                if (!d.entry) return;
                const pct = (d.entry.severe_rate * 100).toFixed(1);
                tooltip.style("opacity", 1).html(
                    `<strong>${d.hour}:00 – ${d.hour + 1}:00</strong><br>
                     Light: ${LIGHT_LABELS[d.light]}<br>
                     Severity rate: <strong>${pct}%</strong><br>
                     Total accidents: ${d.entry.total.toLocaleString()}<br>
                     Serious/fatal: ${d.entry.severe.toLocaleString()}`
                );
                d3.select(this).style("stroke", "#333").style("stroke-width", 1.5);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 14) + "px")
                       .style("top",  (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
                d3.select(this).style("stroke", "none");
            });
    }

    updateHeatmap();

    // ── Public API (called by map) ─────────────────────────────────────────
    window.heatmapSetState = function(stateCode, stateName) {
        selectedState = stateCode;
        const label = stateCode
            ? `${stateName} — Hourly Severity Pattern`
            : "Hourly Accident Severity by Light Condition — All Germany";
        titleEl.text(label);
        updateHeatmap();
    };

    // Synced from map vehicle buttons — no need for own buttons
    window.heatmapSetVehicle = function(vehicle) {
        selectedVehicle = vehicle;
        updateHeatmap();
    };
}