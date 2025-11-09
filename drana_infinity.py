#!/usr/bin/env python3
"""
Drana-Infinity
---------------------------
Designed and maintained by IHA089.
"""

import warnings
warnings.filterwarnings("ignore")
import sys
sys.modules['warnings'] = warnings

import subprocess, json, re, os, sqlite3, hashlib, uuid, secrets, requests
from waitress import serve
from flask import Flask, request, jsonify, render_template, Response, stream_with_context, make_response, send_from_directory
from werkzeug.utils import secure_filename 

try:
    from updater import update_drana_infinity
    update_drana_infinity()
except Exception as e:
    print(f"[Update Check Failed] {e}")


drana_infinity = Flask(__name__)
DB_NAME = 'chat_database.db'
UPLOAD_FOLDER = 'uploads' 
drana_infinity.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def init_db():
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("PRAGMA foreign_keys = ON;")
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_hash TEXT PRIMARY KEY,
            username TEXT NOT NULL
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            project_id TEXT PRIMARY KEY,
            user_hash TEXT NOT NULL,
            title TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_hash) REFERENCES users(user_hash) ON DELETE CASCADE
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            chat_id TEXT PRIMARY KEY,
            user_hash TEXT NOT NULL,
            title TEXT NOT NULL,
            model_name TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            project_id TEXT,
            FOREIGN KEY(user_hash) REFERENCES users(user_hash) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            message_id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            file_path TEXT,
            file_name TEXT,
            FOREIGN KEY(chat_id) REFERENCES chats(chat_id) ON DELETE CASCADE
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS command_outputs (
            output_id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            command TEXT NOT NULL,
            output TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(chat_id) REFERENCES chats(chat_id) ON DELETE CASCADE
        )
    ''')

    try:
        c.execute("ALTER TABLE chats ADD COLUMN model_name TEXT NOT NULL DEFAULT 'llama3'")
    except sqlite3.OperationalError:
        pass
        
    try:
        c.execute("ALTER TABLE messages ADD COLUMN file_path TEXT")
        c.execute("ALTER TABLE messages ADD COLUMN file_name TEXT")
    except sqlite3.OperationalError:
        pass 
        
    try:
        c.execute("ALTER TABLE chats ADD COLUMN project_id TEXT REFERENCES projects(project_id) ON DELETE CASCADE")
    except sqlite3.OperationalError:
        pass 

    conn.commit()
    conn.close()


def get_chat_history_for_ollama(chat_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT sender, text, file_name FROM messages WHERE chat_id = ? ORDER BY timestamp ASC", (chat_id,))
    history = []
    for row in c.fetchall():
        sender, text, file_name = row
        role = 'user' if sender == 'user' else 'assistant'
        content = text
        if file_name:
            content = f"(The user has attached a file: {file_name})\n\n{text}"
        history.append({'role': role, 'content': content})
    conn.close()
    return history

def stream_ollama_response(model_name, history, new_message, chat_id):
    ollama_url = "http://localhost:11434/api/chat"
    
    messages = history 
    
    payload = {
        "model": model_name,
        "messages": messages,
        "stream": True
    }
    
    ai_full_response = ""
    try:
        with requests.post(ollama_url, json=payload, stream=True) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if line:
                    data = json.loads(line.decode("utf-8"))
                    if "content" in data["message"]:
                        ai_full_response += data["message"]["content"]
                        yield data["message"]["content"]
                    if data.get("done"):
                        break
    except Exception as e:
        yield f"[Error: {e}]"
    finally:
        if ai_full_response:
            conn = sqlite3.connect(DB_NAME)
            c = conn.cursor()
            c.execute("INSERT INTO messages (chat_id, sender, text) VALUES (?, ?, ?)", (chat_id, 'ai', ai_full_response))
            conn.commit()
            conn.close()

@drana_infinity.route('/upload_file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
    
    file = request.files['file']
    chat_id = request.form.get('chat_id')

    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file"}), 400
    
    if not chat_id:
        return jsonify({"success": False, "message": "No chat ID"}), 400

    if file:
        filename = secure_filename(file.filename)
        chat_upload_dir = os.path.join(drana_infinity.config['UPLOAD_FOLDER'], chat_id)
        os.makedirs(chat_upload_dir, exist_ok=True)
        
        file_path = os.path.join(chat_upload_dir, filename)
        file.save(file_path)
        
        web_path = f"/uploads/{chat_id}/{filename}"
        return jsonify({"success": True, "file_path": web_path, "file_name": filename})

@drana_infinity.route('/uploads/<chat_id>/<path:filename>')
def uploaded_file(chat_id, filename):
    chat_upload_dir = os.path.join(drana_infinity.config['UPLOAD_FOLDER'], chat_id)
    return send_from_directory(chat_upload_dir, filename)


@drana_infinity.route('/execute_stream', methods=['POST'])
def execute_stream():
    command = request.json.get("command")
    chat_id = request.json.get("chat_id")
    output_id = request.json.get("output_id")

    if not all([command, chat_id, output_id]):
        return jsonify({"success": False, "message": "Missing required data."}), 400

    full_output = ""
    
    def generate_and_save():
        nonlocal full_output
        try:
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            
            for line in iter(process.stdout.readline, ''):
                full_output += line
                yield line
                
            process.stdout.close()
            return_code = process.wait()
            final_status = f"\n[Process finished with exit code {return_code}]\n" if return_code != 0 else f"\n[Process finished successfully]\n"
            full_output += final_status
            yield final_status

        except FileNotFoundError:
            full_output = "[Error: Command not found. Please check your command and environment path.]"
            yield full_output
        except Exception as e:
            full_output = f"[Error: {str(e)}]"
            yield full_output
        finally:
            conn = sqlite3.connect(DB_NAME)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO command_outputs (output_id, chat_id, command, output) VALUES (?, ?, ?, ?)",
                      (output_id, chat_id, command, full_output))
            conn.commit()
            conn.close()

    return Response(stream_with_context(generate_and_save()), mimetype="text/plain")

@drana_infinity.route('/get_command_output', methods=['POST'])
def get_command_output():
    output_id = request.json.get("output_id")
    if not output_id:
        return jsonify({"success": False, "message": "Output ID not provided."}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT command, output FROM command_outputs WHERE output_id = ?", (output_id,))
    result = c.fetchone()
    conn.close()

    if result:
        return jsonify({"success": True, "command": result[0], "output": result[1]})
    else:
        return jsonify({"success": False, "message": "Output not found."}), 404

@drana_infinity.route('/')
def index():
    return render_template('index.html', page_mode='chats', active_project_id=None, active_project_title=None)

@drana_infinity.route('/projects')
def projects_page():
    return render_template('index.html', page_mode='projects', active_project_id=None, active_project_title=None)

@drana_infinity.route('/project/<project_id>')
def project_detail_page(project_id):
    user_hash = request.cookies.get('user_hash')
    project_title = "Project" 
    
    if user_hash:
        try:
            conn = sqlite3.connect(DB_NAME)
            c = conn.cursor()
            c.execute("SELECT title FROM projects WHERE project_id = ? AND user_hash = ?", (project_id, user_hash))
            project = c.fetchone()
            conn.close()
            if project:
                project_title = project[0]
            else:
                project_title = "Unknown Project"
        except Exception as e:
            print(f"Error fetching project title: {e}")
            project_title = "Error"

    return render_template('index.html', page_mode='project_detail', active_project_id=project_id, active_project_title=project_title)

@drana_infinity.route('/login', methods=['POST'])
def login():
    username = request.json.get("username")
    if not username:
        return jsonify({"success": False, "message": "Username not provided."}), 400
    
    user_hash = hashlib.sha256(secrets.token_bytes(32)).hexdigest()

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT user_hash FROM users WHERE username = ?", (username,))
    existing_user = c.fetchone()
    if existing_user:
        user_hash = existing_user[0]
    else:
        c.execute("INSERT INTO users (user_hash, username) VALUES (?, ?)", (user_hash, username))
        conn.commit()
    conn.close()

    response = make_response(jsonify({"success": True, "user_hash": user_hash, "username": username}))
    response.set_cookie('user_hash', user_hash, max_age=60*60*24*365) 
    return response

@drana_infinity.route('/get_user_info', methods=['GET'])
def get_user_info():
    user_hash = request.cookies.get('user_hash')
    if not user_hash:
        return jsonify({"success": False, "message": "User hash not found."}), 401

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE user_hash = ?", (user_hash,))
    user_info = c.fetchone()
    conn.close()

    if user_info:
        return jsonify({"success": True, "username": user_info[0]})
    else:
        return jsonify({"success": False, "message": "User not found."}), 404


@drana_infinity.route('/get_chats', methods=['GET'])
def get_chats():
    user_hash = request.cookies.get('user_hash')
    if not user_hash:
        return jsonify({"success": False, "message": "User hash not found."}), 401
    
    project_id = request.args.get('project_id')

    if not project_id or project_id == 'null' or project_id == 'None':
        project_id = None

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    if project_id: 
        c.execute(
            "SELECT chat_id, title, model_name FROM chats WHERE user_hash = ? AND project_id = ? ORDER BY timestamp DESC", 
            (user_hash, project_id)
        )
    else:
         c.execute(
            "SELECT chat_id, title, model_name FROM chats WHERE user_hash = ? AND (project_id IS NULL OR project_id = 'None') ORDER BY timestamp DESC", 
            (user_hash,)
        )
        
    chat_list = [{"chat_id": row[0], "title": row[1], "model_name": row[2]} for row in c.fetchall()]
    conn.close()
    return jsonify({"success": True, "chats": chat_list})

@drana_infinity.route('/get_chat_messages', methods=['POST'])
def get_chat_messages():
    chat_id = request.json.get("chat_id")
    if not chat_id:
        return jsonify({"success": False, "message": "Chat ID not provided."}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT sender, text, file_path, file_name FROM messages WHERE chat_id = ? ORDER BY timestamp ASC", (chat_id,))
    messages = [{"sender": row[0], "text": row[1], "file_path": row[2], "file_name": row[3]} for row in c.fetchall()]
    conn.close()
    return jsonify({"success": True, "messages": messages})

@drana_infinity.route('/rename_chat', methods=['POST'])
def rename_chat():
    chat_id = request.json.get("chat_id")
    new_title = request.json.get("new_title")
    user_hash = request.cookies.get('user_hash')

    if not all([chat_id, new_title, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400
    
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE chats SET title = ? WHERE chat_id = ? AND user_hash = ?", (new_title, chat_id, user_hash))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@drana_infinity.route('/delete_chat', methods=['POST'])
def delete_chat():
    chat_id = request.json.get("chat_id")
    user_hash = request.cookies.get('user_hash')
    
    if not all([chat_id, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM chats WHERE chat_id = ? AND user_hash = ?", (chat_id, user_hash))
    conn.commit()
    conn.close()
    return jsonify({"success": True})
    
@drana_infinity.route('/create_new_chat', methods=['POST'])
def create_new_chat():
    user_hash = request.cookies.get('user_hash')
    model_name = request.json.get("model_name")
    project_id = request.json.get("project_id") 

    if not user_hash or not model_name:
        return jsonify({"success": False, "message": "Missing user hash or model name."}), 400

    if not project_id or project_id == 'null' or project_id == 'None':
        project_id = None

    chat_id = str(uuid.uuid4())
    default_title = "New Chat"
    
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "INSERT INTO chats (chat_id, user_hash, title, model_name, project_id) VALUES (?, ?, ?, ?, ?)", 
        (chat_id, user_hash, default_title, model_name, project_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "chat_id": chat_id, "title": default_title, "model_name": model_name})

@drana_infinity.route('/chat_stream', methods=['POST'])
def chat_stream():
    user_message = request.json.get("message")
    chat_id = request.json.get("chat_id")
    model_name = request.json.get("model_name")
    user_hash = request.cookies.get('user_hash')
    file_path = request.json.get("file_path")
    file_name = request.json.get("file_name")

    if not all([user_message, chat_id, model_name, user_hash]):
        return jsonify({"response": "Missing chat data."}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("SELECT * FROM messages WHERE chat_id = ?", (chat_id,))
    is_first_message = not c.fetchone()
    if is_first_message:
        chat_title = user_message[:25] + "..." if len(user_message) > 25 else user_message
        c.execute("UPDATE chats SET title = ? WHERE chat_id = ?", (chat_title, chat_id))
        conn.commit()

    c.execute("INSERT INTO messages (chat_id, sender, text, file_path, file_name) VALUES (?, ?, ?, ?, ?)", 
              (chat_id, 'user', user_message, file_path, file_name))
    conn.commit()
    conn.close()

    history = get_chat_history_for_ollama(chat_id)
    
    return Response(stream_with_context(stream_ollama_response(model_name, history, user_message, chat_id)),
                    mimetype="text/plain")

@drana_infinity.route('/get_models', methods=['GET'])
def get_models():
    ollama_url = "http://localhost:11434/api/tags"
    try:
        r = requests.get(ollama_url)
        r.raise_for_status()
        models_data = r.json()
        models = []
        for model in models_data.get('models', []):
            model_name = model['name']
            if "drana" in model_name:
                models.append(model_name)
        return jsonify({"success": True, "models": models})
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "message": f"Error fetching models: {e}"}), 500

@drana_infinity.route('/get_projects', methods=['GET'])
def get_projects():
    user_hash = request.cookies.get('user_hash')
    if not user_hash:
        return jsonify({"success": False, "message": "User hash not found."}), 401
    
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT project_id, title FROM projects WHERE user_hash = ? ORDER BY timestamp DESC", (user_hash,))
    project_list = [{"project_id": row[0], "title": row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify({"success": True, "projects": project_list})

@drana_infinity.route('/create_new_project', methods=['POST'])
def create_new_project():
    user_hash = request.cookies.get('user_hash')
    project_name = request.json.get("project_name")

    if not user_hash or not project_name:
        return jsonify({"success": False, "message": "Missing user hash or project name."}), 400

    project_id = str(uuid.uuid4())
    
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "INSERT INTO projects (project_id, user_hash, title) VALUES (?, ?, ?)", 
        (project_id, user_hash, project_name)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "project_id": project_id, "title": project_name})

@drana_infinity.route('/rename_project', methods=['POST'])
def rename_project():
    project_id = request.json.get("project_id")
    new_title = request.json.get("new_title")
    user_hash = request.cookies.get('user_hash')

    if not all([project_id, new_title, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400
    
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE projects SET title = ? WHERE project_id = ? AND user_hash = ?", (new_title, project_id, user_hash))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@drana_infinity.route('/delete_project', methods=['POST'])
def delete_project():
    project_id = request.json.get("project_id")
    user_hash = request.cookies.get('user_hash')
    
    if not all([project_id, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM projects WHERE project_id = ? AND user_hash = ?", (project_id, user_hash))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

if __name__ == '__main__':
    try:
        init_db()
    except sqlite3.OperationalError:
        print("Database already initialized.")
    
    print("Drana-Infinity server is running on ::: http://127.0.0.1:80")
    serve(drana_infinity, host='127.0.0.1', port=80)
