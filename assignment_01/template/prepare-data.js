function prepareData() {

  // ── Step 1: Parse raw CSV ───────────────────────────────────────────
  const raw = d3.csvParse(rawdata).map(d => {
    return {
      // meta
      date:             d3.isoParse(d.date),
      date_string:      d.date,
      location:         d.location,
      category:         d.category.trim().toLowerCase(),
      title:            d.title.trim(),
      icons:            d.icons.split(',').map(s => s.trim()),
      veg:              d.veg,
      price_per_100_g:  d.price_per_100_g === "true",
      allergens:        d.allergens.split(',').map(s => s.trim()),

      // price
      price_student:    +d.price_student,
      price_guest:      +d.price_guest,

      // energy
      kcal_100g:        +d.kcal_100g,
      kcal_portion:     +d.kcal_portion,
      kj_100g:          +d.kj_100g,
      kj_portion:       +d.kj_portion,

      // nutrition per portion
      carbs_portion:    parseNum(d.carbs_portion),
      fat_portion:      parseNum(d.fat_portion),
      protein_portion:  parseNum(d.protein_portion),
      salt_portion:     parseNum(d.salt_portion),
      sfat_portion:     parseNum(d.sfat_portion),
      sugar_portion:    parseNum(d.sugar_portion),

      // nutrition per 100g
      carbs_100g:       parseNum(d.carbs_100g),
      fat_100g:         parseNum(d.fat_100g),
      protein_100g:     parseNum(d.protein_100g),
      salt_100g:        parseNum(d.salt_100g),
      sfat_100g:        parseNum(d.sfat_100g),
      sugar_100g:       parseNum(d.sugar_100g),

      // CO2
      co2_portion:      parseNum(d.co2_portion),
      co2_100g:         parseNum(d.co2_100g),
    }
  })

  // ── Step 2: Clean ───────────────────────────────────────────────────
  const data = raw.filter(d => {

    // Rule 1 – must have a valid meal type
    if (!d.veg || d.veg.trim() === "") return false

    // Rule 2 – co2_portion must be a real, plausible number
    // 0 values indicate missing data; ≥9999 are obvious placeholders
    if (isNaN(d.co2_portion))     return false
    if (d.co2_portion <= 0)       return false
    if (d.co2_portion >= 9999)    return false

    // Rule 3 – price_student must be a positive number
    if (isNaN(d.price_student))   return false
    if (d.price_student <= 0)     return false

    // Rule 4 – protein_portion must be a plausible number
    // 0 g and values ≥200 g are physiologically implausible
    if (isNaN(d.protein_portion)) return false
    if (d.protein_portion <= 0)   return false
    if (d.protein_portion >= 200) return false

    return true
  })

  // ── Step 3: Log summary ─────────────────────────────────────────────
  console.log(`[prepareData] raw rows     : ${raw.length}`)
  console.log(`[prepareData] rows removed : ${raw.length - data.length}`)
  console.log(`[prepareData] rows kept    : ${data.length}`)
  console.log('[prepareData] sample:', data.slice(0, 3))

  return data
}

// Safe numeric parser — returns NaN for any non-numeric string
// Safer than bare + operator which silently converts "" to 0
function parseNum(val) {
  if (val === null || val === undefined) return NaN
  const n = parseFloat(val)
  return isNaN(n) ? NaN : n
}