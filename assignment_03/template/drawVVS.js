// Draw map and city location marks
function drawVVS() {

    let height = 850;
    let width = 1925;


    // Create the main SVG element
    svg = d3.select("main").append('img')
        .attr('src', 'public/vvsNetz.jpg')
        .attr('width', width)
        .attr('height', height)

}
