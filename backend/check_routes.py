from fastapi import FastAPI
from app.api.v1 import api_router

print('Routes in api_router:')
for route in api_router.routes:
    methods = list(route.methods) if hasattr(route, 'methods') else []
    print(f'  {route.path} - {methods}')
