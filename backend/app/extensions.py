from flask_sqlalchemy import SQLAlchemy

# 全局扩展实例,在 app/__init__.py 的 create_app 里 init_app
db = SQLAlchemy()
