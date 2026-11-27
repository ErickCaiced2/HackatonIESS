"""Las migraciones corren con el usuario dueño de la base (IESS_DATABASE_URL_DUENO), no con el de la app."""
import os

from alembic import context
from sqlalchemy import create_engine

url = os.environ["IESS_DATABASE_URL_DUENO"]
with create_engine(url).connect() as conexion:
    context.configure(connection=conexion, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()
