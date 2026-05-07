import json
import common
import argparse

import pandas as pd

from math import factorial
from pathlib import Path
from pandas.core.groupby.generic import DataFrameGroupBy

def export_graph(path: str, graph: pd.DataFrame):
    """
    Exports graph as json file with and without all trains.

    Parameters:
        path (str): filepath to save the tree at without ending (".json")
        graph (DF): graph calculated by make_graph()

    Returns:
        Nothing
    """

    export = {"nodes": graph[0].to_dict(orient='records'), "links":graph[1].to_dict(orient="records")}
    # write the graph to a json file
    with open(path+'.json', 'w') as file:
        json.dump(export, file, indent=4)

    print("first file done")

    graph_no = graph[0].drop(columns=['trains'])
    export2 = {"nodes": graph_no.to_dict(orient='records'), "links":graph[1].to_dict(orient="records")}

    with open(path+'_without_trains.json', 'w') as file:
        json.dump(export2, file, indent=4)
        
    print("second file done")
   

def make_graph(df: pd.DataFrame):
    """
    Creates a graph with nodes that store some information and incoming edges.

    Parameters:
        df (DF): VVS dataset as dataframe

    Returns:
        DataFrame with the information of stations
    """
    graph_list = []
    links = []
    for index, train in df.iterrows():
        station = train['station']
        if len(graph_list) == 0 or station not in map(lambda x: x['station'], graph_list):
            graph_list.append({'station' : train['station'], 'trains': [train.to_dict()], 'incomming_connection': [train['previous_station']], 'lines': [train['line']], 'category': train['category'], 'long' : train['long'], 'lat' : train['lat']})
        else:
            for item in graph_list:
                if item['station'] == station:
                    item['trains'].append(train.to_dict())
                    if train['previous_station'] not in item['incomming_connection']:
                        item['incomming_connection'].append(train['previous_station'])
                    if train['line'] not in item['lines']:
                        item['lines'].append(train['line'])
    for item in graph_list:
        item['sum_trains'] = len(item['trains'])
    graph = pd.DataFrame(graph_list) 
    print("graph done")
    for index, trains in graph.iterrows():
        if len(trains['trains']) > 0:
            for train in trains['trains']:
                if [train["station"],train["previous_station"]] not in map(lambda x: [x['destination'],x['source']], links):
                    links.append({'source' : train["previous_station"], 'destination': train["station"], 'delay_avg': float(train["departure_delay_m"]), 'delay_sum': int(train["departure_delay_m"]), 'sum_trains': 1})
                else:
                    for item in links:
                        if item['destination'] == train["station"] and item['source'] == train["previous_station"]:
                            item['delay_sum'] = int(item['delay_sum']) + int(train["departure_delay_m"])
                            item['sum_trains'] = int(item['sum_trains']) + 1
                            item['delay_avg'] = int(item['delay_sum'])/int(item['sum_trains'])
        else:
            print(train)
    link_pd = pd.DataFrame(links)
    
    return [graph, link_pd]

if __name__ == "__main__":

    # define the arguments for this script
    parser = argparse.ArgumentParser()
    path_arg = parser.add_argument('datapath', help='path to the CSV dataset')
    path_arg.required = True

    # parse command line arguments
    args = parser.parse_args()

    # read the data file
    try:
        df = common.read_data(args.datapath)
    except ValueError as e:
        exit(-1)

    graph = make_graph(df)
    export_graph('graph', graph)

