// drawTrend.js — Grouped Bar Chart: Accident Counts by Severity per Year
function drawTrend(processedData) {

    const SEVERITY_LABELS = {
        1: "Fatal",
        2: "Serious Injury",
        3: "Minor Injury"
    };

    const SEVERITY_COLORS = {
        1: "#7b1d0e",
        2: "#e05c1a",
        3: "#f5c07a"
    };

    const SEVERITY_ORDER = [1, 2, 3];

    const margin = { top: 50, right: 160, bottom: 60, left: 70 };
    const width  = 900 - margin.left - margin.right;
    const height = 300 - margin.top  - margin.bottom;

    // ── Container ──────────────────────────────────────────────────────────
    const container = d3.select("#trend-card")
        .append("div")
        .attr("id", "trend-container")
        .style("font-family", "sans-serif")
        .style("max-width", "960px")
        .style("margin", "32px auto 40px auto");

    container.append("h2")
        .style("text-align", "center")
        .style("font-size", "17px")
        .style("font-weight", "700")
        .style("color", "#1a1a2e")
        .style("margin", "0 0 2px 0")
        .text("Accident Counts by Severity per Year : All Germany");

    container.append("p")
        .style("text-align", "center")
        .style("font-size", "12px")
        .style("color", "#888")
        .style("margin", "0 0 14px 0")
        .text("All vehicles · All states · 2016–2024");
    container.append("p")
    .style("text-align", "center")
    .style("font-size", "11px")
    .style("color", "#aaa")
    .style("margin", "-10px 0 14px 0")
    .html("⚠ Y-axis uses a <strong>logarithmic scale</strong> to show fatal, serious, and minor accidents together");
    // ── SVG ────────────────────────────────────────────────────────────────
    const svg = container.append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .style("display", "block")
        .style("margin", "0 auto");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // ── Scales ─────────────────────────────────────────────────────────────
    const years = d3.range(2016, 2025);

    const xScale = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.2);

    const xInner = d3.scaleBand()
        .domain(SEVERITY_ORDER)
        .range([0, xScale.bandwidth()])
        .padding(0.08);

    const yScale = d3.scaleLog().base(10).range([height, 0]).clamp(true);

    // ── Axes ───────────────────────────────────────────────────────────────
    const xAxisG = g.append("g").attr("transform", `translate(0, ${height})`);
    const yAxisG = g.append("g");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margin.top + height / 2))
        .attr("y", 16)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("Number of Accidents");

    svg.append("text")
        .attr("x", margin.left + width / 2)
        .attr("y", margin.top + height + 50)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("Year");

    const gridG = g.append("g");
    const barsG = g.append("g");

    // ── Tooltip ────────────────────────────────────────────────────────────
    const tooltip = d3.select("body").append("div")
        .attr("id", "trend-tooltip")
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
    const legendG = svg.append("g")
        .attr("transform", `translate(${margin.left + width + 20}, ${margin.top})`);

    SEVERITY_ORDER.forEach((sev, i) => {
        const row = legendG.append("g").attr("transform", `translate(0, ${i * 22})`);
        row.append("rect")
            .attr("width", 14).attr("height", 14).attr("rx", 2)
            .style("fill", SEVERITY_COLORS[sev]);
        row.append("text")
            .attr("x", 20).attr("y", 11)
            .style("font-size", "11px")
            .style("fill", "#444")
            .text(SEVERITY_LABELS[sev]);
    });

    // ── Data ───────────────────────────────────────────────────────────────
    const merged = {};
    processedData.year.forEach(d => {
        const key = `${d.year}_${d.severity}`;
        if (!merged[key]) merged[key] = { year: d.year, severity: d.severity, count: 0 };
        merged[key].count += d.count;
    });
    const data = Object.values(merged);

    // Build lookup: year → severity → count
    const lookup = {};
    data.forEach(d => {
        if (!lookup[d.year]) lookup[d.year] = {};
        lookup[d.year][d.severity] = d.count;
    });

    // ── Render ─────────────────────────────────────────────────────────────
    const maxVal = d3.max(years, yr =>
        d3.max(SEVERITY_ORDER, sev => (lookup[yr] && lookup[yr][sev]) || 0)
    ) || 0;

    yScale.domain([100, maxVal * 1.1]);  // log scale can't start at 0
    xAxisG.call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
        .selectAll("text").style("font-size", "11px");

    yAxisG.call(d3.axisLeft(yScale).tickValues([100, 500, 1000, 5000, 10000, 50000, 100000]).tickFormat(d3.format(",d")))
        .selectAll("text").style("font-size", "10px");

    
    // Bars
    const allBars = [];
    for (const year of years) {
        for (const sev of SEVERITY_ORDER) {
            allBars.push({ year, severity: sev, count: (lookup[year] && lookup[year][sev]) || 0 });
        }
    }

    barsG.selectAll("rect")
        .data(allBars)
        .join("rect")
        .attr("x", d => xScale(d.year) + xInner(d.severity))
        .attr("width", xInner.bandwidth())
        .attr("rx", 2)
        .style("fill", d => SEVERITY_COLORS[d.severity])
        .attr("y", height)
        .attr("height", 0)
        .transition().duration(600)
        .attr("y", d => yScale(d.count))
        .attr("height", d => height - yScale(d.count));

    // Tooltip (attached after transition, on the selection)
    barsG.selectAll("rect")
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1).html(
                `<strong>${d.year}</strong><br>
                 Severity: <strong>${SEVERITY_LABELS[d.severity]}</strong><br>
                 Accidents: <strong>${d.count.toLocaleString()}</strong>`
            );
            d3.select(this).style("opacity", 0.8);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 14) + "px")
                   .style("top",  (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
            d3.select(this).style("opacity", 1);
        });
}