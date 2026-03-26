import sys
sys.path.insert(0, '.')

from app.db.session import engine, Base
from app.models import *

# Drop all tables
Base.metadata.drop_all(bind=engine)
print('Dropped all tables')

# Recreate all tables with new schema
Base.metadata.create_all(bind=engine)
print('Recreated all tables with new schema')
print('Database schema updated successfully!')
