"""Export browser-ready, Summer-only aggregates for OlympicLens Viz 2."""
from pathlib import Path
import json
import pandas as pd

ROOT = (Path(__file__).resolve().parents[1] if "__file__" in globals()
        else (Path.cwd().parent / "template").resolve())
SOURCE = ROOT.parent / "python" / "olympics_master_cleaned.csv"
OUTPUT = ROOT / "public" / "data" / "viz2_efficiency_yearly.json"

# Geometry names in public/data/countries.geo.json. Historical identities remain
# separate records; geometry_name is only the modern outline used to draw them.
NAME_FIX = {
    "UK": "United Kingdom", "USA": "United States of America",
    "Tanzania": "United Republic of Tanzania", "Bahamas": "The Bahamas",
    "Guinea-Bissau": "Guinea Bissau", "Congo": "Republic of the Congo",
    "Republic of Congo": "Republic of the Congo", "Trinidad": "Trinidad and Tobago",
    "Timor-Leste": "East Timor", "Serbia": "Republic of Serbia",
    "Boliva": "Bolivia", "": "",
}
HISTORICAL = {
    "URS": ("Russia", "Russia"), "EUN": ("Russia", "Russia"),
    "GDR": ("Germany", "Germany"), "FRG": ("Germany", "Germany"),
    "YUG": ("Republic of Serbia", "Serbia"), "SCG": ("Republic of Serbia", "Serbia"),
    "ANZ": ("Australia", "Australia"), "BOH": ("Czech Republic", "Czech Republic"),
    "TCH": ("Czech Republic", "Czech Republic"), "SAA": ("Germany", "Germany"),
}
HISTORICAL_LABELS = {
    "URS": "Soviet Union", "EUN": "Unified Team", "GDR": "East Germany",
    "FRG": "West Germany", "YUG": "Yugoslavia", "SCG": "Serbia and Montenegro",
    "ANZ": "Australasia", "BOH": "Bohemia", "TCH": "Czechoslovakia",
    "SAA": "United Team of Germany",
}
UNSUPPORTED = {"IOA", "ROT", "UNK", "MIX"}


def clean_event_list(frame):
    if frame.empty:
        return []
    return sorted(frame["Event"].dropna().unique().tolist())


def main():
    geometry_names = {f["properties"]["name"] for f in json.loads(
        (ROOT / "public" / "data" / "countries.geo.json").read_text(encoding="utf-8")
    )["features"]}
    use = ["ID", "NOC", "region", "Continent", "Year", "Season", "City", "Sport", "Event", "Medal"]
    df = pd.read_csv(SOURCE, usecols=use, na_values=[], keep_default_na=False)
    df = df[(df.Season == "Summer") & (df.Year.isin([
        1896,1900,1904,1908,1912,1920,1924,1928,1932,1936,1948,1952,1956,
        1960,1964,1968,1972,1976,1980,1984,1988,1992,1996,2000,2004,2008,2012,2016
    ]))].copy()
    df["ID"] = pd.to_numeric(df.ID)
    medal_rows = df[df.Medal.isin(["Gold", "Silver", "Bronze"])].copy()
    medals = medal_rows.drop_duplicates(["Year", "NOC", "Sport", "Event", "Medal"])
    # Games-level medal totals are deduplicated by event and medal type across NOCs,
    # so team medals are counted once per event rather than once per athlete/team row.
    games_medals = medal_rows.drop_duplicates(["Year", "Sport", "Event", "Medal"])
    year_stats = {}
    for year, edition in df.groupby("Year"):
        won = games_medals[games_medals.Year == year]
        counts = won.Medal.value_counts()
        year_stats[str(int(year))] = {
            "discipline_count": int(edition.Sport.nunique()),
            "total_medals": int(len(won)),
            "gold_medals": int(counts.get("Gold", 0)),
            "silver_medals": int(counts.get("Silver", 0)),
            "bronze_medals": int(counts.get("Bronze", 0)),
        }

    # First facts are scoped nationally and by sport. Ties within an edition retain every event.
    facts = {}
    for noc, noc_df in medal_rows.groupby("NOC"):
        for scope, scoped in [("All sports", noc_df)] + list(noc_df.groupby("Sport")):
            gold = scoped[scoped.Medal == "Gold"]
            fm_year = int(scoped.Year.min()) if not scoped.empty else None
            fg_year = int(gold.Year.min()) if not gold.empty else None
            facts[(noc, scope)] = {
                "first_medal_year": fm_year,
                "first_medal_events": clean_event_list(scoped[scoped.Year == fm_year]) if fm_year else [],
                "first_gold_year": fg_year,
                "first_gold_events": clean_event_list(gold[gold.Year == fg_year]) if fg_year else [],
            }

    records = []
    for (year, noc), edition in df.groupby(["Year", "NOC"]):
        scopes = [("All sports", edition)] + list(edition.groupby("Sport"))
        for scope, participants in scopes:
            won = medals[(medals.Year == year) & (medals.NOC == noc)]
            if scope != "All sports":
                won = won[won.Sport == scope]
            counts = won.Medal.value_counts()
            breakdown = {m: int(counts.get(m, 0)) for m in ["Gold", "Silver", "Bronze"]}
            total = sum(breakdown.values())
            sport_counts = won.groupby("Sport").size().sort_values(ascending=False)
            region = HISTORICAL_LABELS.get(noc, str(participants.region.iloc[0]))
            geom = NAME_FIX.get(region, region)
            mapped_to = None
            if noc in HISTORICAL:
                geom, mapped_to = HISTORICAL[noc]
            mapping_status = ("historical" if mapped_to else
                              ("direct" if geom in geometry_names else "unsupported"))
            fact = facts.get((noc, scope), {})
            records.append({
                "year": int(year), "noc": noc, "label": region, "sport": scope,
                "continent": str(participants.Continent.iloc[0]), "host": str(participants.City.iloc[0]),
                "geometry_name": geom, "mapping_status": mapping_status, "mapped_to": mapped_to,
                "athletes": int(participants.ID.nunique()), **breakdown, "medals": total,
                "efficiency": round(total / participants.ID.nunique(), 5),
                "best_sport": str(sport_counts.index[0]) if len(sport_counts) else None,
                **fact,
            })

    payload = {
        "meta": {
            "season": "Summer", "years": sorted(df.Year.unique().astype(int).tolist()),
            "medal_dedup_key": ["Year", "NOC", "Sport", "Event", "Medal"],
            "games_medal_dedup_key": ["Year", "Sport", "Event", "Medal"],
            "athlete_key": "ID", "unsupported_nocs": sorted({r["noc"] for r in records if r["mapping_status"] == "unsupported"}),
            "historical_geometry_map": {k: v[0] for k, v in HISTORICAL.items()},
        },
        "year_stats": year_stats,
        "records": records,
    }
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(records):,} records for {len(payload['meta']['years'])} Summer editions to {OUTPUT}")


if __name__ == "__main__":
    main()
