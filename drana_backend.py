import sqlite3
import os
import uuid
import time

DB_NAME = 'chat_database.db'
UPLOAD_FOLDER = 'uploads'

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
            project_type TEXT DEFAULT '',
            FOREIGN KEY(user_hash) REFERENCES users(user_hash) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS interceptor_projects (
            id TEXT PRIMARY KEY,
            user_hash TEXT NOT NULL,
            name TEXT,
            created_at TEXT,
            FOREIGN KEY(user_hash) REFERENCES users(user_hash) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS traffic (
            id TEXT PRIMARY KEY, 
            project_id TEXT NOT NULL,
            timestamp TEXT,
            scheme TEXT,
            method TEXT,
            host TEXT,
            path TEXT,
            status_code INTEGER,
            content_type TEXT,
            size TEXT,
            time_taken TEXT,
            request_raw TEXT,
            response_raw TEXT,
            analysis TEXT,
            recon TEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            chat_id TEXT PRIMARY KEY,
            user_hash TEXT NOT NULL,
            title TEXT NOT NULL,
            model_name TEXT NOT NULL DEFAULT 'llama3',
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

    c.execute('''
        CREATE TABLE IF NOT EXISTS graph_nodes (
            node_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            parent_id TEXT,
            label TEXT,
            type TEXT,
            content TEXT,
            full_log TEXT,
            command TEXT,
            status TEXT,
            multiline TEXT,
            selectedLine TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS required_tools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT NOT NULL UNIQUE,
            version_command TEXT,
            install_link TEXT,
            icon_class TEXT DEFAULT 'fa fa-terminal',
            is_installed BOOLEAN DEFAULT 0,
            detected_version TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS node_interceptor_links (
            node_id TEXT PRIMARY KEY,
            interceptor_project_id TEXT NOT NULL,
            FOREIGN KEY(interceptor_project_id) REFERENCES interceptor_projects(id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    conn.close()

def get_linked_interceptor_project(node_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("SELECT interceptor_project_id FROM node_interceptor_links WHERE node_id = ?", (node_id,))
        row = c.fetchone()
        return row[0] if row else None
    except Exception:
        return None
    finally:
        conn.close()

def link_node_to_interceptor(node_id, project_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("INSERT OR REPLACE INTO node_interceptor_links (node_id, interceptor_project_id) VALUES (?, ?)", (node_id, project_id))
        conn.commit()
    except Exception as e:
        print(f"[DB Error] Link Node Failed: {e}")
    finally:
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

def create_interceptor_project(name, user_hash):
    new_id = str(uuid.uuid4())
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    current_timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    try:
        c.execute("INSERT INTO interceptor_projects (id, user_hash, name, created_at) VALUES (?, ?, ?, ?)", 
                    (new_id, user_hash, name, current_timestamp))
        conn.commit()
        return new_id
    except Exception as e:
        print(f"[DB Error] Create Project Failed: {e}")
        return None
    finally:
        conn.close()

def get_interceptor_project_by_name(name, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("SELECT id FROM interceptor_projects WHERE name = ? AND user_hash = ?", (name, user_hash))
        row = c.fetchone()
        return row[0] if row else None
    except Exception as e:
        print(f"[DB Error] Get Project By Name Failed: {e}")
        return None
    finally:
        conn.close()

def get_all_interceptor_projects(user_hash):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT id, name, created_at FROM interceptor_projects WHERE user_hash = ? ORDER BY created_at DESC", (user_hash,))
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows

def delete_interceptor_project(project_id, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("DELETE FROM traffic WHERE project_id = ?", (project_id,))
        c.execute("DELETE FROM interceptor_projects WHERE id = ? AND user_hash = ?", (project_id, user_hash))
        conn.commit()
    except Exception as e:
        print(f"Error deleting project: {e}")
    finally:
        conn.close()

def get_project_traffic(project_id):
    print("Fetching traffic for project_id: ", project_id)
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    current_timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    c.execute("UPDATE interceptor_projects SET created_at = ? WHERE id = ?", (current_timestamp, project_id, ))
    conn.commit()
    c.execute("SELECT * FROM traffic WHERE project_id = ?", (project_id,))
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows

def save_request(project_id, flow_data):
    if not project_id: return

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    summary = flow_data.get('summary', {})
    full = flow_data.get('full_data', {})
    flow_id = flow_data.get('id')

    try:
        c.execute('''INSERT INTO traffic (id, project_id, timestamp, scheme, method, host, path, status_code, content_type, size, time_taken, request_raw, response_raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (flow_id, project_id, summary.get('time'), summary.get('scheme'), summary.get('method'), summary.get('host'), summary.get('path'), summary.get('status'), summary.get('content_type'), summary.get('size'), summary.get('time_taken'), full.get('request_raw_text'), full.get('response_raw_text')))
        conn.commit()
    except sqlite3.IntegrityError:
        pass 
    except Exception as e:
        print(f"[DB Error] Save Request Failed: {e}")
    finally:
        conn.close()

def get_req_analysis(id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT analysis FROM traffic WHERE id = ?", (id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def get_req_recon(id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT recon FROM traffic WHERE id = ?", (id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def get_req_recon(id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT recon FROM traffic WHERE id = ?", (id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def save_req_analysis(id, analysis):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE traffic SET analysis = ? WHERE id = ?", (analysis, id))
    conn.commit()
    conn.close()

def save_req_recon(id, recon):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE traffic SET recon = ? WHERE id = ?", (recon, id))
    conn.commit()
    conn.close()

def ai_full_response(chat_id, ai_full_response):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO messages (chat_id, sender, text) VALUES (?, ?, ?)", (chat_id, 'ai', ai_full_response))
    conn.commit()
    conn.close()

def update_requests_data(summary, full_data, request_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("UPDATE traffic SET timestamp = ?, method = ?, host = ?, path = ?, status_code = ?, content_type = ?, size = ?, request_raw = ?, response_raw = ? WHERE id = ?", (summary['time'], summary['method'], summary['host'], summary['path'], summary['status'], summary['content_type'], summary['size'], full_data['request_raw_text'], full_data['response_raw_text'], request_id))
        conn.commit()
    except Exception as e:
        print(f"DB Update Error: {e}")
    finally:
        conn.close()

def read_req_resp_host(flow_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT host, request_raw, response_raw FROM traffic WHERE id = ?", (flow_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return {
            'host': row[0],
            'request_raw': row[1],
            'response_raw': row[2]
        }
    return None

def get_interceptor_projects(project_id):
    conn = sqlite3.connect(DB_NAME) 
    c = conn.cursor()
    c.execute("SELECT name FROM interceptor_projects WHERE id = ?", (project_id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else "Unknown Project"

def read_interceptor_project_data(project_id, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT title FROM projects WHERE project_id = ? AND user_hash = ?", (project_id, user_hash))
    project = c.fetchone()
    conn.close()
    if project:
        project_title = project[0]
    else:
        project_title = "Unknown Project"
    return project_title

def save_node_info(data):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO graph_nodes (node_id, project_id, parent_id, label, type, content, full_log, command, status, multiline, selectedLine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (data.get('node_id'), data.get('project_id'), data.get('parent_id'), data.get('label'), data.get('type'), data.get('content'), data.get('full_log', ''), data.get('command', ''), data.get('status', 'pending'), data.get('multiline', ''),data.get('selectedLine', '')))
    conn.commit()
    conn.close()

def delete_node(node_id, project_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM graph_nodes WHERE node_id = ? AND project_id = ?", (node_id, project_id))
    conn.commit()
    conn.close()

def get_node_data(project_id):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM graph_nodes WHERE project_id = ?", (project_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def save_execute_stream_data(output_id, chat_id, command, full_output):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO command_outputs (output_id, chat_id, command, output) VALUES (?, ?, ?, ?)", (output_id, chat_id, command, full_output))
    conn.commit()
    conn.close()

def get_command_output(output_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT command, output FROM command_outputs WHERE output_id = ?", (output_id,))
    result = c.fetchone()
    conn.close()
    return result

def check_user_info(username):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT user_hash FROM users WHERE username = ?", (username,))
    existing_user = c.fetchone()
    conn.close()
    return existing_user

def create_user(username, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO users (username, user_hash) VALUES (?, ?)", (username, user_hash))
    conn.commit()
    conn.close()

def get_user_info(user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE user_hash = ?", (user_hash,))
    user_info = c.fetchone()
    conn.close()
    return user_info

def get_chats_for_user(user_hash, project_id=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if project_id: 
        c.execute("SELECT chat_id, title, model_name FROM chats WHERE user_hash = ? AND project_id = ? ORDER BY timestamp DESC", (user_hash, project_id))
    else:
         c.execute("SELECT chat_id, title, model_name FROM chats WHERE user_hash = ? AND (project_id IS NULL OR project_id = 'None') ORDER BY timestamp DESC", (user_hash,))
    chat_list = [{"chat_id": row[0], "title": row[1], "model_name": row[2]} for row in c.fetchall()]
    conn.close()
    return chat_list

def get_chat_msg_for_user(chat_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT sender, text, file_path, file_name FROM messages WHERE chat_id = ? ORDER BY timestamp ASC", (chat_id,))
    messages = [{"sender": row[0], "text": row[1], "file_path": row[2], "file_name": row[3]} for row in c.fetchall()]
    conn.close()
    return messages

def rename_user_chat(chat_id, new_title, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE chats SET title = ? WHERE chat_id = ? AND user_hash = ?", (new_title, chat_id, user_hash))
    conn.commit()
    conn.close()

def delete_user_chat(chat_id, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM chats WHERE chat_id = ? AND user_hash = ?", (chat_id, user_hash))
    conn.commit()
    conn.close()

def create_new_user_chat(chat_id, user_hash, default_title, model_name, project_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO chats (chat_id, user_hash, title, model_name, project_id) VALUES (?, ?, ?, ?, ?)", (chat_id, user_hash, default_title, model_name, project_id))
    conn.commit()
    conn.close()

def save_user_chat_history(chat_id, user_message, file_path=None, file_name=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT * FROM messages WHERE chat_id = ?", (chat_id,))
    is_first_message = not c.fetchone()
    if is_first_message:
        chat_title = user_message[:25] + "..." if len(user_message) > 25 else user_message
        c.execute("UPDATE chats SET title = ? WHERE chat_id = ?", (chat_title, chat_id))
        conn.commit()
    c.execute("INSERT INTO messages (chat_id, sender, text, file_path, file_name) VALUES (?, ?, ?, ?, ?)", (chat_id, 'user', user_message, file_path, file_name))
    conn.commit()
    conn.close()

def get_user_project_info(user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT project_id, title, project_type FROM projects WHERE user_hash = ? ORDER BY timestamp DESC", (user_hash,))
    project_list = [{"project_id": row[0], "title": row[1], "type": row[2]} for row in c.fetchall()]
    conn.close()
    return project_list

def create_new_project_user(project_id, user_hash, project_name, project_type):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO projects (project_id, user_hash, title, project_type) VALUES (?, ?, ?, ?)", (project_id, user_hash, project_name, project_type))
    conn.commit()
    conn.close()

def rename_user_project(project_id, new_title, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE projects SET title = ? WHERE project_id = ? AND user_hash = ?", (new_title, project_id, user_hash))
    conn.commit()
    conn.close()

def delete_user_project(project_id, user_hash):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM projects WHERE project_id = ? AND user_hash = ?", (project_id, user_hash))
    conn.commit()
    conn.close()

def fetch_node_data(node_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT * FROM graph_nodes WHERE node_id = ?", (node_id,))
    result = c.fetchone()
    conn.close()
    return result