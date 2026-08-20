import re
from datetime import datetime, timezone

# 以太坊地址格式校验:0x + 40 位十六进制(不校验 checksum,见 docs/data-model.md 三)
ADDRESS_RE = re.compile(r'^0x[0-9a-fA-F]{40}$')

# wei 金额:纯数字字符串(金额一律字符串存 wei,见 docs/data-model.md 三)
WEI_RE = re.compile(r'^\d+$')

# 交易哈希:0x + 64 位十六进制
TX_HASH_RE = re.compile(r'^0x[0-9a-fA-F]{64}$')


def is_valid_address(value):
    return isinstance(value, str) and bool(ADDRESS_RE.match(value))


def is_valid_wei(value):
    return isinstance(value, str) and bool(WEI_RE.match(value))


def is_valid_tx_hash(value):
    return isinstance(value, str) and bool(TX_HASH_RE.match(value))


def parse_iso(value):
    """ISO 8601 字符串 → naive UTC datetime(落库用),解析失败返回 None"""
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        return None
