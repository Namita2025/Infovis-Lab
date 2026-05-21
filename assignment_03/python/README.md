# Assignment 3

This folder contains all files for assignment 3.

## Visualization

Use the provided skeleton `template`.

## Python Setup and Usage

To use the python scripts provided to you make sure you have Python >=3.7 installed.
If you have python installed, navigate to the `python` folder on the command line and execute the following steps.

1. Create a virtual environment with `python -m venv <env-name>`
2. Activate your virtual environment with one of the following commands, depending on your OS and shell
   - Windows Shell: `<env-name>\Scripts\activate.bat`
   - Windows PowerShell: `<env-name>\Scripts\Activate.ps1`
   - POSIX bash/zsh: `source <env-name>/bin/activate`
   - POSIX fish: `source <env-name>/bin/activate.fish`
   - POSIX csh/tcsh: `source <env-name>/bin/activate.csh`
   - POSIX PowerShell Core: `<env-name>/bin/Activate.ps1`
3. Install all required packages
   - `pip install pandas` (this will also install `numpy`, so no separate install necessary)
   - `pip install anytree`
   - `pip install notebook`
   - `pip install matplotlib` (optional, only necessary when you want to plot something)
4. To deactivate your virtual environment, type `deactivate`

### Jupyter Notebook

To open and edit a jupyter notebook, simply go to the data directory, activate your environment and type `jupyter notebook` to open jupyter notebook in the current directory or type `jupyter notebook <name>.ipynb` to directly open a specific notebook. This will start a local server and open your browser.
We provide a basic jupyter notebook file in the data directory to get you started.

For more information on jupyter notebook, please refer to [https://jupyter-notebook.readthedocs.io/en/stable/](https://jupyter-notebook.readthedocs.io/en/stable/).

### Graph Making Scripts

In the data directory, you will find two python scripts `make_hierarchy.py` and `make_graph_vvs.py`. The scripts contain utilities that take a data file and create a graph from it, stored in a JSON file. You can call these from inside a jupyter notebook and use it's functions there or alternatively call the scripts in the console. Simply activate your environment and type `python <script_path> [args ...]`. Each script also has a help flag (`-h` or `--help`) which prints usage directions to the console.

**Make Hierarchy**

The `make_hierarchy_vvs.py` script expects the path to a data file (CSV) and a station to construct the hierarchy from. The hierarchy will be a breadth-first search through the graph. You can find all possible station names via the help flag or the `LIST_STATIONS` in `common.py`.
Here is an example invocation:

```console
python make_hierarchy_vvs.py VVStrainrides.csv Hauptbahnhof
```

The JSON file consists of an object which is the root of the tree and its attributes (arrival/departure Delay Mean/Sum, category, layer, lat & long, sumArrivals, lines) and its children as an array.
This recursive structure represents the hierarchy as each node stores its children.

**Make Graph**

The `make_graph_vvs.py` script expects the path to a data file (CSV).
Here is an example invocation:

```console
python make_graph_vvs.py VVStrainrides.csv
```

This JSON file consist of an object that stores the two arrays ''nodes'' and ''links'' of the graph.
Nodes represent the ''station'' and some other attributes (incomming_connection, lines, category, lat & long, sum_trains).
The links store connections from A to B with the ''source'' and ''destination'' and further attributes (delay_avg, delay_sum, sum_trains)

This script will generate two files, one where all trains are stored within the nodes, which can lead to a bigger file, and one where the trains are ommitted.
If you dont need single traines use the file with '\_ot.json' as ending.
Else you can adjust the scripts if you need more attributes or use the file with trains.
