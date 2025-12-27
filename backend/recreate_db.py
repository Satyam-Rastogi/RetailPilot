from app.db.session import engine
from app.db.base import Base
from app.models import company_profile, customer, supplier, item, invoice

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print('Database recreated successfully')
