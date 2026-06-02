# Assignment 4

This folder contains all files for assignment 4.

## Visualization

Use the provided skeleton template, see the respective README.md for more information on how to use the skeleton.

## Python Setup and Usage

To use the python scripts provided to you make sure you have Python >=3.7 installed.
If you have python installed, navigate to the `python` folder on the command line and execute the following steps.

**Easiest:**

1. vscode hit CTRL+SHIFT+P, type python env and hit enter, then follow the instructions
2. every time you open the terminal vscode should start the environment, if not see below (you might need to kill open ones)
3. go to 3. below

**Alternative:**

1. Create a virtual environment with `python -m venv <env-name>`
2. Activate your virtual environment with one of the following commands, depending on your OS and shell
   - Windows Shell: `<env-name>\Scripts\activate.bat`
   - Windows PowerShell: `<env-name>\Scripts\Activate.ps1`
   - POSIX bash/zsh: `source <env-name>/bin/activate`
   - POSIX fish: `source <env-name>/bin/activate.fish`
   - POSIX csh/tcsh: `source <env-name>/bin/activate.csh`
   - POSIX PowerShell Core: `<env-name>/bin/Activate.ps1`

3. Install all required packages
   - `pip install pandas flask`
4. To run the Flask server run:
   ```bash
   python server.py
   ```
5. To deactivate your virtual environment, type `deactivate`

### Jupyter Notebook

You can edit jupyter notebooks in vscode, simply open the file.

Alternatively, to open and edit a jupyter notebook, simply go to the data directory, activate your environment and type `jupyter notebook` to open jupyter notebook in the current directory or type `jupyter notebook <name>.ipynb` to directly open a specific notebook. This will start a local server and open your browser.
We provided a basic jupyter notebook file in the data directory to get you started.

For more information on jupyter notebook, please refer to [https://jupyter-notebook.readthedocs.io/en/stable/](https://jupyter-notebook.readthedocs.io/en/stable/).
