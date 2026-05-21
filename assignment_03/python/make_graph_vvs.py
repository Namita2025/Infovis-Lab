import json
import common
import argparse
import pandas as pd
from pathlib import Path
from pandas.core.groupby.generic import DataFrameGroupBy

# S-Bahn lines only (S1-S6, S60)
SBAHN_LINES = ['1', '2', '3', '4', '5', '6', '60']

# Some rows are missing one decimal digit in lat/long (off by factor 10)
LAT_FIX_THRESHOLD = 10
LONG_FIX_THRESHOLD = 2
COORD_FIX_MULTIPLIER = 10

def export_graph(path: str, graph: pd.DataFrame):
    """
    Exports graph as json file with and without all trains.

    Parameters:
    path (str): filepath to save the tree at without ending (".json")
    graph (DF): graph calculated by make_graph()

    Returns:
    Nothing
    """
    export = {"nodes": graph[0].to_dict(orient='records'), "links": graph[1].to_dict(orient="records")}
    with open(path + '.json', 'w') as file:
        json.dump(export, file, indent=4)
    print("first file done")

    graph_no = graph[0].drop(columns=['trains'])
    export2 = {"nodes": graph_no.to_dict(orient='records'), "links": graph[1].to_dict(orient="records")}
    with open(path + '_without_trains.json', 'w') as file:
        json.dump(export2, file, indent=4)
    print("second file done")

def make_graph(df: pd.DataFrame):
    """
    Creates a graph with nodes and edges for the VVS S-Bahn network.

    Modifications from original:
    1. Fix lat/long coordinates (divide by 1,000,000)
    2. Filter entire dataframe to S-Bahn lines only — removes regional trains
       (lines 13, 18, 12, 16, 90, 17a, RB46 etc.) that share stations but are
       not part of the VVS S-Bahn network. This ensures sum_trains, delay averages,
       node sizes, and edge counts all reflect only S-Bahn traffic.
    3. Add delay_change = departure_delay_m - arrival_delay_m
    4. Add delay_change_avg per station (overall node coloring)
    5. Add delay_change_per_line per station (per S-Bahn line coloring)
    6. Add lines list to each node and edge (for route highlighting)

    Parameters:
    df (DF): VVS dataset as dataframe

    Returns:
    List of [nodes DataFrame, links DataFrame]
    """

    # --- MODIFICATION 1: Fix coordinates ---
    # lat/long are stored without decimal point, divide by 1,000,000
    df['lat'] = df['lat'] / 1000000
    df['long'] = df['long'] / 1000000

    # Fix malformed coordinates that are too small for the Stuttgart area
    lat_mask = df['lat'].notna() & (df['lat'] > 0) & (df['lat'] < LAT_FIX_THRESHOLD)
    long_mask = df['long'].notna() & (df['long'] > 0) & (df['long'] < LONG_FIX_THRESHOLD)
    df.loc[lat_mask, 'lat'] = df.loc[lat_mask, 'lat'] * COORD_FIX_MULTIPLIER
    df.loc[long_mask, 'long'] = df.loc[long_mask, 'long'] * COORD_FIX_MULTIPLIER

    # --- MODIFICATION 2: Filter to S-Bahn lines only ---
    # Regional trains (lines 13, 18, 12, 16, 90, 17a, RB46, etc.) also stop at
    # VVS S-Bahn stations but are NOT S-Bahn. Without this filter:
    #   - sum_trains is inflated (e.g. Schorndorf showed 1,088 instead of ~553)
    #   - node sizes and delay averages mix S-Bahn and regional train data
    #   - edges and lines arrays include non-S-Bahn services
    df = df[df['line'].isin(SBAHN_LINES)].copy()
    print(f"Filtered to S-Bahn only: {len(df)} rows remaining")

    # --- MODIFICATION 3: Add delay_change column ---
    # positive = amplifier (delay gets worse at this station)
    # negative = absorber (delay gets better at this station)
    # zero = neutral
    df['delay_change'] = df['departure_delay_m'] - df['arrival_delay_m']

    # --- MODIFICATION 4: Calculate overall delay_change per station ---
    station_delay = df.groupby('station').agg(
        delay_change_avg=('delay_change', 'mean'),
        arrival_delay_avg=('arrival_delay_m', 'mean'),
        departure_delay_avg=('departure_delay_m', 'mean')
    ).reset_index()

    # --- MODIFICATION 5: Calculate delay_change per station per S-Bahn line ---
    # df is already filtered to S-Bahn lines, so no extra filter needed here
    line_delay = df.groupby(['station', 'line']).agg(
        delay_change_avg=('delay_change', 'mean'),
        arrival_delay_avg=('arrival_delay_m', 'mean'),
        departure_delay_avg=('departure_delay_m', 'mean'),
        sum_trains=('delay_change', 'count')
    ).reset_index()

    # Convert per-line stats into a dictionary per station
    # Format: { "1": {"delay_change_avg": 0.5, ...}, "2": {...}, ... }
    line_delay_dict = {}
    for _, row in line_delay.iterrows():
        station = row['station']
        line = row['line']
        if station not in line_delay_dict:
            line_delay_dict[station] = {}
        line_delay_dict[station][line] = {
            'delay_change_avg': round(row['delay_change_avg'], 4),
            'arrival_delay_avg': round(row['arrival_delay_avg'], 4),
            'departure_delay_avg': round(row['departure_delay_avg'], 4),
            'sum_trains': int(row['sum_trains'])
        }

    # --- Build graph nodes ---
    graph_list = []
    links = []

    for index, train in df.iterrows():
        station = train['station']
        if len(graph_list) == 0 or station not in map(lambda x: x['station'], graph_list):
            graph_list.append({
                'station': train['station'],
                'trains': [train.to_dict()],
                'incomming_connection': [train['previous_station']],
                'lines': [train['line']],  # safe: df already filtered to S-Bahn only
                'category': train['category'],
                'long': train['long'],
                'lat': train['lat']
            })
        else:
            for item in graph_list:
                if item['station'] == station:
                    item['trains'].append(train.to_dict())
                    if train['previous_station'] not in item['incomming_connection']:
                        item['incomming_connection'].append(train['previous_station'])
                    if train['line'] not in item['lines']:
                        item['lines'].append(train['line'])

    # Add sum_trains to each node — now reflects S-Bahn traffic only
    for item in graph_list:
        item['sum_trains'] = len(item['trains'])

    # --- MODIFICATION 6: Add delay stats to each node ---
    for item in graph_list:
        station = item['station']

        station_row = station_delay[station_delay['station'] == station]
        if not station_row.empty:
            item['delay_change_avg'] = round(float(station_row['delay_change_avg'].values[0]), 4)
            item['arrival_delay_avg'] = round(float(station_row['arrival_delay_avg'].values[0]), 4)
            item['departure_delay_avg'] = round(float(station_row['departure_delay_avg'].values[0]), 4)
        else:
            item['delay_change_avg'] = 0.0
            item['arrival_delay_avg'] = 0.0
            item['departure_delay_avg'] = 0.0

        item['delay_per_line'] = line_delay_dict.get(station, {})

    graph = pd.DataFrame(graph_list)
    print("graph done")

    # --- Build edges (links) ---
    for index, trains in graph.iterrows():
        if len(trains['trains']) > 0:
            for train in trains['trains']:
                link_exists = [
                    train["station"], train["previous_station"]
                ] in map(lambda x: [x['destination'], x['source']], links)

                if not link_exists:
                    links.append({
                        'source': train["previous_station"],
                        'destination': train["station"],
                        'delay_avg': float(train["departure_delay_m"]),
                        'delay_sum': int(train["departure_delay_m"]),
                        'sum_trains': 1,
                        'lines': [train["line"]]  # safe: df already S-Bahn only
                    })
                else:
                    for item in links:
                        if item['destination'] == train["station"] and item['source'] == train["previous_station"]:
                            item['delay_sum'] = int(item['delay_sum']) + int(train["departure_delay_m"])
                            item['sum_trains'] = int(item['sum_trains']) + 1
                            item['delay_avg'] = int(item['delay_sum']) / int(item['sum_trains'])
                            if train["line"] not in item['lines']:
                                item['lines'].append(train["line"])

    link_pd = pd.DataFrame(links)
    return [graph, link_pd]

if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    path_arg = parser.add_argument('datapath', help='path to the CSV dataset')
    path_arg.required = True

    args = parser.parse_args()

    try:
        df = common.read_data(args.datapath)
    except ValueError as e:
        exit(-1)

    graph = make_graph(df)
    export_graph('graph', graph)