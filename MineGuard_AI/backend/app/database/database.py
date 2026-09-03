from __future__ import annotations

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.app.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def initialize_database() -> None:
    from backend.app.database import models

    Base.metadata.create_all(bind=engine)
    if DATABASE_URL.startswith("sqlite"):
        with engine.begin() as connection:
            inspector = inspect(connection)
            for table_name in ["sensor_readings", "predictions"]:
                existing = inspector.get_columns(table_name)
                columns = {column["name"] for column in existing}
                if table_name == "sensor_readings" and "source" not in columns:
                    connection.exec_driver_sql('ALTER TABLE sensor_readings ADD COLUMN source VARCHAR(40) DEFAULT "SENSOR"')
                if table_name == "predictions" and "source" not in columns:
                    connection.exec_driver_sql('ALTER TABLE predictions ADD COLUMN source VARCHAR(40) DEFAULT "SENSOR"')


def get_db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()