from datetime import datetime, timezone


def utcnow():
    """当前 UTC 时间(SQLite 无时区,统一存 naive UTC,序列化时再加 Z 后缀)"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_iso(dt):
    """DateTime → ISO 8601 UTC 字符串(2026-08-19T10:00:00Z),见 docs/data-model.md 三"""
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None
