"""
Delete all files from the results folder that are not linked to a query
"""
import glob
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)) + "/../..")
from backend.lib.database import Database
from backend.lib.logger import Logger
from backend.lib.query import SearchQuery
import config

logger = Logger()
database = Database(logger=logger)

os.chdir(config.PATH_DATA)
files = glob.glob("*.*")

for file in files:
	key = file.split(".")[0].split("-")[-1]
	try:
		query = SearchQuery(key=key, db=database)
	except TypeError:
		print("Not linked to a query: %s" % file)
		os.unlink(file)