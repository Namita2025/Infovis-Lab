import common
import argparse

import pandas as pd

from pathlib import Path
from anytree import Node, RenderTree, AsciiStyle, search, LevelOrderIter
from anytree.exporter import JsonExporter

def export_hierarchy(path: str, root: object):
    """
    Exports a given anytree hierarchy to the given path.

    Parameters:
        path (str): filepath to save the tree at
        root (object): anytree node representing the tree

    Returns:
        Nothing
    """

    exporter = JsonExporter(indent=2, sort_keys=True, ensure_ascii=False)
    with open(path, 'w') as file:
        exporter.write(root, file)

def make_hierarchy(df: pd.DataFrame, station: str = "Hauptbahnhof"):
    """
    Create a tree via breadth-first search for a given station.

    Parameters:
        df (DataFrame): pandas dataframe holding the data

    Returns:
        root (obj): root node (anytree) of the resulting tree
    """

    # add columns year and month for easier filtering
    stations = sorted(df['station'].unique())

    root = Node(name=station)
    root.layer = 0

    done = []
    done_name = []

    current_layer = [root]
    current_layer_name = [station]
    new_layer = []
    new_layer_name = []
    iter = 1

    while(len(stations) > len(done) + len(current_layer) and len(current_layer) > 0):
        for st in current_layer:
            from_list = df[df['station'] == st.name]
            to_list = df[df['previous_station'] == st.name]
            for index, i in from_list.iterrows():
                name = i['previous_station']
                if name not in new_layer_name and name not in done_name and name not in current_layer_name:
                    if(not pd.isnull(name) and name != "" and name != "Station outside VVS" and name != "Start"):
                        new_st = Node(name=name, parent = st, layer = iter)
                        new_layer.append(new_st)
                        new_layer_name.append(name)
            for index, i in to_list.iterrows():
                name = i['station']
                if name not in new_layer_name and name not in done_name and name not in current_layer_name:
                    if(not pd.isnull(name) and name != "" and name != "Station outside VVS" and name != "Start"):
                        new_st = Node(name=name, parent = st, layer = iter)
                        new_layer.append(new_st)
                        new_layer_name.append(name)
            done.append(st.name)
            done_name.append(st.name)
        current_layer = new_layer
        current_layer_name = new_layer_name
        new_layer = []
        new_layer_name = []
        #print(iter, done, current_layer)
        iter = iter + 1


#            station_node = Node(str(day), parent=root)


    # for all nodes, add some data
    for node in LevelOrderIter(root):


        # get only the data that matches this node (i.e. same year and month)
        filtered = df[(df['station'] == node.name)]


        node.sumArrivals = filtered.shape[0]
        # how to count the different genres for this node
        # can be done for other fields in the same manner, e.g. 'steamspy_tags'
        # could also be filtered before adding, etc.
        # node.genres = filtered.explode('genres')['genres'].value_counts().to_dict()

        # love me some stats
        node.arrivalDelayMean = str(filtered['arrival_delay_m'].mean())
        node.departureDelayMean = str(filtered['departure_delay_m'].mean())
        node.arrivalDelaySum = str(filtered['arrival_delay_m'].sum())
        node.departureDelaySum = str(filtered['departure_delay_m'].sum())
        node.lines = filtered['line'].unique().tolist()
        node.category = filtered['category'].unique().tolist()[0]
        node.lat = filtered['lat'].unique().tolist()[0]
        node.long = filtered['long'].unique().tolist()[0]     


    return root

if __name__ == "__main__":

    # define the arguments for this script
    parser = argparse.ArgumentParser()
    path_arg = parser.add_argument('datapath', help='path to the CSV dataset')
    path_arg.required = True
    attr_arg = parser.add_argument(
        'station',
        help='which station to make the hierarchy from',
        choices= common.LIST_STATIONS
    )
    attr_arg.required = True

    # parse command line arguments
    args = parser.parse_args()

    # read the data file
    try:
        df = common.read_data(args.datapath)
    except ValueError as e:
        exit(-1)

    root = make_hierarchy(df, args.station)
    export_hierarchy('tree-path_' + args.station +'.json', root)
