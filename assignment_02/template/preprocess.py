#!/usr/bin/env python3
import json
from pathlib import Path
from collections import defaultdict
import sys


BASE_DIR = Path(__file__).parent
PUBLIC_DIR = BASE_DIR / "public"

EXCLUDE_FILES = {"germany_states.geo.json", "metadata.json", "processed_data.json"}

STATE_NAMES = {
    "01": "Schleswig-Holstein",
    "02": "Hamburg",
    "03": "Niedersachsen",
    "04": "Bremen",
    "05": "Nordrhein-Westfalen",
    "06": "Hessen",
    "07": "Rheinland-Pfalz",
    "08": "Baden-Württemberg",
    "09": "Bayern",
    "10": "Saarland",
    "11": "Berlin",
    "12": "Brandenburg",
    "13": "Mecklenburg-Vorpommern",
    "14": "Sachsen",
    "15": "Sachsen-Anhalt",
    "16": "Thüringen",
}

COVERAGE = {"05": 2019, "16": 2019, "13": 2020}

MISSING_STATES = {
    "05": {"name": "North Rhine-Westphalia", "data_starts": 2019},
    "16": {"name": "Thuringia", "data_starts": 2019},
    "13": {"name": "Mecklenburg-Vorpommern", "data_starts": 2020},
}

def find_all_input_files():
    """Return ALL json data files in public/, excluding known non-data files."""
    if not PUBLIC_DIR.exists():
        return []
    files = [p for p in sorted(PUBLIC_DIR.glob("*.json")) if p.name not in EXCLUDE_FILES]
    return files


def load_and_normalize(path):
    with path.open('r', encoding='utf-8') as f:
        data = json.load(f)

    top_type = type(data).__name__

    if not isinstance(data, list):
        return top_type, [], []

    rows = []
    columns = []

    if len(data) == 0:
        return top_type, rows, columns

    first = data[0]
    
    # Column mapping by position from metadata.json
    COLUMN_MAP = {
        0: "ULAND",
        4: "UJAHR",
        6: "USTUNDE",
        8: "UKATEGORIE",
        11: "ULICHTVERH",
        13: "IstRad",
        16: "IstKrad",
    }
    FIELD_NAMES = [
        "stateCode", "administrativeRegionCode", "districtCode", "municipalityCode",
        "year", "month", "hour", "weekday", "severity", "accidentKind", "accidentType",
        "lightCondition", "roadSurfaceCondition", "involvesBicycle", "involvesPassengerCar",
        "involvesPedestrian", "involvesMotorcycle", "involvesGoodsRoadVehicle", "involvesOther",
        "longitude", "latitude"
    ]
    
    if isinstance(first, list):
        # list of lists, all rows are data (no header row)
        columns = FIELD_NAMES
        for r in data:
            if not isinstance(r, list) or len(r) == 0:
                continue
            # Extract columns by position and map to field names
            row = {}
            for col_idx, field_name in COLUMN_MAP.items():
                row[field_name] = r[col_idx] if col_idx < len(r) else None
            rows.append(row)
    elif isinstance(first, dict):
        # list of dicts
        columns = sorted({k for row in data for k in (row.keys() if isinstance(row, dict) else [])})
        rows = [dict(r) for r in data if isinstance(r, dict)]

    return top_type, rows, columns


def safe_int(v, default=None):
    if v is None or v == "":
        return default
    try:
        return int(v)
    except Exception:
        try:
            return int(float(v))
        except Exception:
            return default


def normalize_state_code(val):
    if val is None:
        return None
    s = str(val).strip()
    if s == "":
        return None
    try:
        n = int(float(s))
        return f"{n:02d}"
    except Exception:
        return s.zfill(2)


def main():
    input_files = find_all_input_files()
    if not input_files:
        sys.exit(1)

    all_rows = []
    columns = []
    top_type = None
    for input_file in input_files:
        top_type, rows, columns = load_and_normalize(input_file)
        all_rows.extend(rows)

    rows = all_rows

    required = ["ULAND", "UJAHR", "USTUNDE", "UKATEGORIE", "ULICHTVERH"]
    skipped_missing = 0
    cleaned_rows = []
    for r in rows:
        missing = False
        for k in required:
            if k not in r or r[k] in (None, ""):
                missing = True
                break
        if missing:
            skipped_missing += 1
            continue

        # normalize ULAND and numeric fields
        r_norm = dict(r)
        r_norm["ULAND"] = normalize_state_code(r_norm.get("ULAND"))
        r_norm["UJAHR"] = safe_int(r_norm.get("UJAHR"))
        r_norm["USTUNDE"] = safe_int(r_norm.get("USTUNDE"))
        r_norm["UKATEGORIE"] = safe_int(r_norm.get("UKATEGORIE"))
        r_norm["ULICHTVERH"] = safe_int(r_norm.get("ULICHTVERH"))
        cleaned_rows.append(r_norm)

    # Filter for bikes/motorcycles
    matched_rows = []
    not_matched_count = 0
    for r in cleaned_rows:
        ist_rad = safe_int(r.get("IstRad"), 0)
        ist_krad = safe_int(r.get("IstKrad"), 0)
        bike = (ist_rad is not None and ist_rad >= 1)
        moto = (ist_krad is not None and ist_krad == 1)
        if bike or moto:
            # keep the row but annotate involvement
            r["_bike"] = bike
            r["_moto"] = moto
            matched_rows.append(r)
        else:
            not_matched_count += 1

    # Aggregations
    map_counts = defaultdict(lambda: {"total": 0, "severe": 0})
    hour_counts = defaultdict(lambda: {"total": 0, "severe": 0})
    year_counts = defaultdict(int)  # (year, severity, vehicle) -> count
    for r in matched_rows:
        state = r.get("ULAND")
        year = r.get("UJAHR")
        hour = r.get("USTUNDE")
        severity = r.get("UKATEGORIE")
        light = r.get("ULICHTVERH")

        if state is None or year is None or hour is None or severity is None or light is None:
            # shouldn't happen because of earlier checks, but safe-guard
            continue

        is_severe = 1 if severity in (1, 2) else 0

        vehicles = []
        if r.get("_bike"):
            vehicles.append("bike")
        if r.get("_moto"):
            vehicles.append("motorcycle")

        for vehicle in vehicles:
            key_map = (state, year, vehicle)
            map_counts[key_map]["total"] += 1
            map_counts[key_map]["severe"] += is_severe

            key_hour = (state, hour, light, vehicle)
            hour_counts[key_hour]["total"] += 1
            hour_counts[key_hour]["severe"] += is_severe

            key_year = (year, severity, vehicle)
            year_counts[key_year] += 1

    # Build output lists sorted for determinism
    map_list = []
    for (state, year, vehicle), vals in sorted(map_counts.items(), key=lambda x: (x[0][0], x[0][1], x[0][2])):
        total = vals["total"]
        severe = vals["severe"]
        # Check coverage: if state in COVERAGE and year < coverage -> null
        if state in COVERAGE and year < COVERAGE[state]:
            entry = {
                "state": state,
                "state_name": STATE_NAMES.get(state, None),
                "year": year,
                "vehicle": vehicle,
                "total": None,
                "severe": None,
                "severe_rate": None,
                "no_data_reason": f"Data available from {COVERAGE[state]} onwards",
            }
        else:
            severe_rate = round(severe / total, 4) if total > 0 else 0.0
            entry = {
                "state": state,
                "state_name": STATE_NAMES.get(state, None),
                "year": year,
                "vehicle": vehicle,
                "total": total,
                "severe": severe,
                "severe_rate": severe_rate,
            }
        map_list.append(entry)

    hour_list = []
    for (state, hour, light, vehicle), vals in sorted(hour_counts.items(), key=lambda x: (x[0][0], x[0][1], x[0][2], x[0][3])):
     total = vals["total"]
     severe = vals["severe"]
     severe_rate = round(severe / total, 4) if total > 0 else 0.0
     hour_list.append({
        "state": state,
        "state_name": STATE_NAMES.get(state, None),
        "hour": int(hour),
        "light": int(light),
        "vehicle": vehicle,
        "total": total,
        "severe": severe,
        "severe_rate": severe_rate,
    })

    year_list = []
    for (year, severity, vehicle), count in sorted(year_counts.items(), key=lambda x: (x[0][0], x[0][1], x[0][2])):
        year_list.append({
            "year": int(year),
            "severity": int(severity),
            "vehicle": vehicle,
            "count": count,
        })

    expected_years = set(range(2016, 2025))
    matched_years = sorted({r.get("UJAHR") for r in matched_rows if r.get("UJAHR") is not None})
    output_years = sorted({entry["year"] for entry in year_list})

    print("Years found in matched rows:", matched_years)
    print("Years present in processed_data.year:", output_years)
    print("Missing years from matched rows:", sorted(expected_years - set(matched_years)))
    print("Missing years from processed_data.year:", sorted(expected_years - set(output_years)))

    output = {
        "map": map_list,
        "hour": hour_list,
        "year": year_list,
        "coverage": COVERAGE,
        "missing_states": MISSING_STATES,
    }

    out_path = PUBLIC_DIR / "processed_data.json"
    with out_path.open('w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
