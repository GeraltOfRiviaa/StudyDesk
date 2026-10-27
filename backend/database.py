from pymongo import AsyncMongoClient
import os



db = AsyncMongoClient(os.environ["MONGO_URL"], tz_aware=True).studydesk
