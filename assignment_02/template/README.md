# Weather Data VIS

## Setup
- Install the Live Server extension to Visual Studio Code: [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)

## Start
- Open the `template` project in Visual Studio Code
- Press the `Go Live` button (at the bottom right side of the status bar)
- The webpage will be opened automatically in the browser
Data Preprocessing Notes
2017 Data Fix
During preprocessing, it was discovered that accident records for 2017 were missing from the output despite being present in the source data. Investigation revealed that the involvesBicycle and involvesMotorcycle columns (indices 13 and 16) contained null values for all 2017 entries — unlike later years where these fields are explicitly set to 0 or 1. This is a schema difference in the original dataset: the involvement flags were not recorded for 2017.

As a result, the vehicle filter in preprocess.py was updated to treat null as a valid involvement value rather than excluding those rows entirely.

Excel to JSON Conversion
The raw 2017 accident data was originally available as an Excel file (.xlsx) with multiple sheets. The file was converted to a JSON array-of-arrays format to match the structure expected by preprocess.py. Each sheet was parsed separately and all rows were combined into a single JSON file, with NaN values preserved as null. The converted file was placed in the public/ directory alongside the other data files.

The conversion was performed manually in a separate notebook and is not included in this repository. After conversion, preprocess.py was re-run to regenerate processed_data.json with the 2017 records correctly included.