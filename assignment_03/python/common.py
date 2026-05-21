import logging
import pandas as pd
from pathlib import Path


LIST_STATIONS = ["Bietigheim-Bissingen",  "Asperg", "Tamm", "Ludwigsburg", "Kornwestheim", "Zuffenhausen", "Feuerbach", "Nordbahnhof", "Hauptbahnhof", 
    "Stadtmitte", "Feuersee", "Schwabstrassse", "Backnang", "Marbach", "Benningen", "Freiberg", "Farvoritepark", "Weil der Stadt", "Malmsheim", "Renningen", 
    "Rutesheim", "Leonberg", "Hoefingen", "Ditzingen", "Weilimdorf", "Korntal", "Neuwirtshaus", "Maichingen Nord", "Herrenberg", "Nufringen", "Gaertringen", 
    "Ehningen", "Hulb", "Boeblingen", "Goldberg", "Rohr", "Vaihingen", "Oesterfeld", "Universitaet", "Bad Cannstatt", "Neckarpark", "Untertuerkheim", "Obertuerkheim",
    "Mettingen", "Esslingen", "Oberesslingen", "Zell", "Altbach", "Plochingen", "Wernau", "Wendlingen", "Oetlingen", "Kirchheim", "Schorndorf", "Weiler", 
    "Winterbach", "Geradstetten", "Grunbach", "Beutelsbach", "Endersbach", "Stetten-Beinstein", "Rommelshausen", "Maubach", "Nellmersbach", "Winnenden", 
    "Schwaikheim", "Neustadt-Hohenacker", "Waiblingen", "Fellbach", "Sommerrain", "Nürnberger Strassse", "Oberaichen", "Leinfelden", "Echterdingen", "Flughafen/Messe", "Filderstadt"
]

def read_data(path: str):

    dp = Path(path)
    if not dp.exists():
        raise ValueError(f'ERROR: file "{dp}" does not exist')

    if not dp.is_file():
        raise ValueError(f'ERROR: "{dp}" is not a file')

    if dp.suffix != '.csv':
        raise ValueError(f'ERROR: file "{dp}" is not a CSV file (but should be)')

    return pd.read_csv(path)