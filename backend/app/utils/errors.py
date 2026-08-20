from flask import jsonify

# 统一错误响应格式 { error, message },见 docs/api-spec.md「通用错误响应格式」
def api_error(code, message, status):
    return jsonify({'error': code, 'message': message}), status
