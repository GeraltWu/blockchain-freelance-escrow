from pathlib import Path

from flask import Flask
from flask_cors import CORS

from .config import Config
from .extensions import db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # SQLite 文件所在目录要先建好,否则 create_all 建不了库文件
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    CORS(app, origins=[o.strip() for o in app.config['CORS_ORIGINS'].split(',')])

    from .routes.escrows import bp as escrows_bp
    app.register_blueprint(escrows_bp, url_prefix='/api')

    from .routes.transactions import bp as transactions_bp
    app.register_blueprint(transactions_bp, url_prefix='/api')

    with app.app_context():
        db.create_all()
        _migrate_dev_sqlite()

    return app


def _migrate_dev_sqlite():
    """开发期轻量迁移:create_all 只建缺失的表,不会给已存在的表补列。
    为老库补上 arbitrator_address 列;正式多环境演进时应改用 Flask-Migrate。"""
    if db.engine.url.get_backend_name() != 'sqlite':
        return
    with db.engine.connect() as conn:
        columns = [row[1] for row in conn.exec_driver_sql('PRAGMA table_info(escrows)')]
        if 'arbitrator_address' not in columns:
            # 旧行(旧合约时期数据)没有仲裁者信息,列允许 NULL;新写入由 POST 校验保证必有值
            conn.exec_driver_sql(
                'ALTER TABLE escrows ADD COLUMN arbitrator_address VARCHAR(42)'
            )
            conn.commit()
