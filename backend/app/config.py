import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    """全局配置,可用 backend/.env 覆盖(见 .env.example)"""

    # SQLite 路径:.env 里写相对 backend 的路径(如 instance/app.db)或完整 sqlite:/// URL
    _sqlite = os.getenv('SQLITE_PATH', 'instance/app.db')
    SQLALCHEMY_DATABASE_URI = (
        _sqlite
        if _sqlite.startswith('sqlite')
        else f"sqlite:///{(BASE_DIR / _sqlite).as_posix()}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # 允许跨域的前端地址,逗号分隔
    CORS_ORIGINS = os.getenv(
        'CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'
    )
