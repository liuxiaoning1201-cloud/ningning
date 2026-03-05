"""最簡 AI 角色聊天 - 單一檔案後端"""
import os
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__, static_folder='.')

API_KEY = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=API_KEY, base_url='https://api.deepseek.com')


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json or {}
    messages = data.get('messages', [])
    if not messages:
        return jsonify({'error': '需要 messages'}), 400
    try:
        r = client.chat.completions.create(
            model='deepseek-chat',
            messages=messages,
            max_tokens=1024
        )
        return jsonify({'reply': r.choices[0].message.content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    if not API_KEY:
        print('請建立 .env 並填入 OPENAI_API_KEY=你的金鑰')
    app.run(port=5000)
