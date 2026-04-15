function prepareData() {
    // parses raw CSV data into JS objects
    const data = d3.csvParse(rawdata).map(d => {
        return {
            ...d,
            // meta data
            date: d3.isoParse(d.date),
            date_string: d.date,
            location: d.location,
            category: d.category.trim().toLowerCase(),
            title: d.title.trim(),
            icons: d.icons.split(',').map(s => s.trim()),
            veg: d.veg,
            // price
            price_student: +d.price_student,
            price_guest: +d.price_guest,
            price_per_100_g: d.price_per_100_g === "true",
            // energy
            kcal_100g: +d.kcal_100g,
            kcal_portion: +d.kcal_portion,
            kj_100g: +d.kj_100g,
            kj_portion: +d.kj_portion,
            // allergens
            allergens: d.allergens.split(',').map(s => s.trim()),
            // nutrition
            carbs_100g: +d.carbs_100g,
            carbs_portion: +d.carbs_portion,
            fat_100g: +d.fat_100g,
            fat_portion: +d.fat_portion,
            protein_100g: +d.protein_100g,
            protein_portion: +d.protein_portion,
            salt_100g: +d.salt_100g,
            salt_portion: +d.salt_portion,
            sfat_100g: +d.sfat_100g,
            sfat_portion: +d.sfat_portion,
            sugar_100g: +d.sugar_100g,
            sugar_portion: +d.sugar_portion,
            // CO2
            co2_100g: +d.co2_100g,
            co2_portion: +d.co2_portion,
        }
    })
    console.log('data:', data)
    return data
}
