import sys
import os

# Ensure current directory is in sys.path
api_dir = os.path.dirname(__file__)
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from main import app
