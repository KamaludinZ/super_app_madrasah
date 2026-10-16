"""Fixture bersama: MongoDB sungguhan untuk uji yang butuh perilaku database asli (index unik, query)."""

import os
import uuid

import pytest


@pytest.fixture
async def mongo_db():
    """Database sementara di MONGO_URL_UJI (bawaan mongodb://127.0.0.1:27017), dihapus setelah uji.
    Uji dilewati bila server MongoDB tidak tersedia."""
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.getenv('MONGO_URL_UJI', 'mongodb://127.0.0.1:27017'), serverSelectionTimeoutMS=800)
    try:
        await client.admin.command('ping')
    except Exception:  # noqa: BLE001
        client.close()
        pytest.skip('MongoDB uji tidak tersedia')
    nama = f'uji_{uuid.uuid4().hex[:10]}'
    yield client[nama]
    await client.drop_database(nama)
    client.close()
