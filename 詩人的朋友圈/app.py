"""
Flask 後端 - 使用 OpenAI SDK 調用 DeepSeek API
"""
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI
import os

load_dotenv()

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False


@app.after_request
def cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

API_KEY = os.getenv('OPENAI_API_KEY')

client = OpenAI(
    api_key=API_KEY,
    base_url='https://api.deepseek.com'
) if API_KEY else None


@app.route('/health')
def health():
    return jsonify({'ok': True, 'hasKey': bool(API_KEY)})


@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        return '', 204

    if not API_KEY:
        return jsonify({
            'error': '請在 .env 檔案中設定 OPENAI_API_KEY'
        }), 500

    data = request.get_json() or {}
    system = data.get('system')
    messages = data.get('messages')

    if not system or not isinstance(messages, list) or len(messages) == 0:
        return jsonify({'error': '缺少 system 或 messages'}), 400

    api_messages = [
        {'role': 'system', 'content': system},
        *[
            {'role': m.get('role', 'user'), 'content': m.get('content', '')}
            for m in messages
        ]
    ]

    try:
        response = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'deepseek-chat'),
            messages=api_messages,
            max_tokens=1024,
            temperature=0.7
        )
        reply = response.choices[0].message.content or ''
        return jsonify({'reply': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3001))
    print(f'API 後端已啟動：http://localhost:{port}')
    if not API_KEY:
        print('警告：未設定 OPENAI_API_KEY')
    app.run(host='0.0.0.0', port=port)
