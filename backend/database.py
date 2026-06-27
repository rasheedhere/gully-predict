import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL must be specified in the environment variables.")

# Ensure we use the asyncpg driver, as PaaS providers like Render often supply postgres:// or postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg does not support 'sslmode', it uses 'ssl'
if "sslmode=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("sslmode=", "ssl=")
# asyncpg does not support 'channel_binding'
if "channel_binding=" in DATABASE_URL:
    # remove channel_binding=... from the URL
    import re
    DATABASE_URL = re.sub(r'(&|\?)channel_binding=[^&]*', '', DATABASE_URL)
    # clean up dangling ? or & at the end just in case
    DATABASE_URL = DATABASE_URL.rstrip('?&')

# Create the async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
)

# Create the async session factory
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db():
    async with async_session() as session:
        yield session
