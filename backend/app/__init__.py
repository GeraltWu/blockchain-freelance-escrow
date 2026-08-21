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

    return app
