import sys
import os

# Make sure backend directory is on the import path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import app
