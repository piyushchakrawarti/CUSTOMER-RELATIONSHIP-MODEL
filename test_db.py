import aiomysql, asyncio
from database import settings

async def test():
    try:
        conn = await aiomysql.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            db=settings.DB_NAME,
        )
        print('DB Connected OK')
        conn.close()
    except Exception as e:
        print(f'DB Error: {e}')

asyncio.run(test())
