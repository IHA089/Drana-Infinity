import sys
import os
import collections
import collections.abc

if not hasattr(collections, 'MutableMapping'):
    collections.MutableMapping = collections.abc.MutableMapping

from gevent import monkey
monkey.patch_all()

import warnings
warnings.filterwarnings("ignore")
sys.modules['warnings'] = warnings

import threading
import queue
import re
import json
import subprocess
import tempfile
import sqlite3
import hashlib
import uuid
import secrets
import shutil
import time
import atexit
from datetime import datetime 
import get_model
import copy

import requests 
from flask import Flask, request, jsonify, render_template, Response, stream_with_context, make_response, send_from_directory, url_for
from werkzeug.utils import secure_filename 
from flask_socketio import SocketIO, emit

from ddgs import DDGS 
from rag_backend import init_rag
import drana_backend
import drana_prompt
import js_recon

drana_infinity = Flask(__name__)
drana_infinity.config['SECRET_KEY'] = 'drana-infinity-secret-key-999' 
DB_NAME = 'chat_database.db'
UPLOAD_FOLDER = 'uploads' 
drana_infinity.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
TOOLS_FILE = 'tool_info.json'

socketio = SocketIO(drana_infinity, async_mode='gevent', cors_allowed_origins="*")

init_rag(drana_infinity)

PROXY_PROCESS = None

class CommandExecutor:
    def execute(self, command):
        try:
            result = subprocess.run(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            
            return result.stdout

        except Exception as e:
            return f"Error executing command: {str(e)}"
            
    def execute_with_status(self, command):
        try:
            result = subprocess.run(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            output = result.stdout
            
            # Subprocess returncode checking
            success = result.returncode == 0
            
            # Common bug bounty tool error strings that don't always trigger a bad returncode
            error_signatures = ["QUITTING!", "Error:", "failed to initialize", "command not found"]
            for sig in error_signatures:
                if sig.lower() in output.lower():
                    success = False
                    
            return success, output

        except Exception as e:
            return False, f"Exception executing command: {str(e)}"

command_executor = CommandExecutor()

def start_proxy_engine():
    global PROXY_PROCESS
    if not os.path.exists('proxy_engine.py'):
        print("[!] Warning: 'proxy_engine.py' not found. Interceptor will not work.")
        return

    print("[*] Launching Drana Interceptor Engine (Background)...")
    try:
        PROXY_PROCESS = subprocess.Popen([sys.executable, 'proxy_engine.py'])
    except Exception as e:
        print(f"[!] Failed to start proxy engine: {e}")

def ensure_browser_setup():
    chrome_dir = os.path.join(os.path.dirname(__file__), "chrome-linux64")
    driver_bin = os.path.join(os.path.dirname(__file__), "chromedriver")
    
    if not os.path.exists(chrome_dir) or not os.path.exists(driver_bin):
        print("[!] Portable Chrome or Driver missing. Running setup_browser.py...")
        if not os.path.exists("setup_browser.py"):
            print("[-] Error: 'setup_browser.py' not found. Cannot auto-setup.")
            return

        try:
            subprocess.run([sys.executable, "setup_browser.py"], check=True)
        except Exception as e:
            print(f"[-] Error running setup_browser.py: {e}")
            sys.exit(1)

def stop_proxy_engine():
    global PROXY_PROCESS
    if PROXY_PROCESS:
        print("[*] Stopping Interceptor Engine...")
        PROXY_PROCESS.terminate()
        PROXY_PROCESS = None

atexit.register(stop_proxy_engine)

def perform_web_search(query):
    print(f"[*] Searching web for: {query}")
    try:
        results = DDGS().text(query, max_results=6)
        if not results:
            return None
        search_context = "### REAL-TIME WEB SEARCH RESULTS ###\n"
        for i, res in enumerate(results):
            search_context += f"Result {i+1}:\n   - Title: {res['title']}\n   - URL: {res['href']}\n   - Snippet: {res['body']}\n\n"
        return search_context
    except Exception as e:
        print(f"[!] Search Error: {e}")
        return f"System: Web search failed: {e}"

def read_default_cmds(cmdtype):
    try:
        with open('default_commands.json', 'r') as f:
            data = json.load(f)
            try:
                return data[cmdtype]
            except KeyError:
                return {}         
    except Exception as e:
        print(f"[!] Error reading default commands: {e}")
        return {}

def read_prompts(file_path):
    file_path = "prompts/"+file_path
    if not os.path.exists(file_path):
        return ""
    try:
        with open(file_path, 'r') as f:
            return f.read()
    except Exception as e:
        print(f"[!] Error reading prompts: {e}")
        return ""

def parse_markdown_json(text):
    match = re.search(r'\{.*\}', text, re.DOTALL)
    
    if match:
        json_str = match.group(0)
        return json.loads(json_str)
    else:
        return json.loads(text)

def ask_to_model(model_name, query):
    ollama_url = "http://localhost:11434/api/chat"
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": query}],
        "stream": False
    }
    try:
        response = requests.post(ollama_url, json=payload)
        response.raise_for_status()
        resp = json.loads(response.text)
        return resp['message']['content']
    except Exception as e:
        return f"[Error: {e}]"


def ask_to_model_with_js(model_name, system_prompt, client_prompt):
    ollama_url = "http://localhost:11434/api/chat"

    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": client_prompt
            }
        ],
        "stream": False
    }

    print(payload["messages"][0]["role"])     
    print(payload["messages"][1]["role"])     


    try:
        response = requests.post(ollama_url, json=payload, timeout=120)
        response.raise_for_status()
        resp = response.json()
        print("-------------------------------")
        print(resp)
        print("-------------------------------")
        return resp["message"]["content"]
    except Exception as e:
        return f"[Error: {e}]"


def stream_ollama_response(model_name, history, new_message, chat_id, use_search=False):
    ollama_url = "http://localhost:11434/api/chat"
    current_time = datetime.now().strftime("%A, %B %d, %Y %H:%M:%S")
    
    system_instruction = (
        f"SYSTEM INFO: The current date and time is {current_time}.\n"
        "You are Drana-Infinity, a helpful AI assistant.\n"
    )

    final_content = new_message

    print("use_search: ", use_search)
    
    if use_search:
        search_results = perform_web_search(new_message)
        if search_results:
            system_instruction += (
                "INSTRUCTION: You have access to real-time search results below. "
                "You MUST use these search results to answer the user's question. "
                "Always cite the source URL when providing facts.\n"
            )
            final_content = (
                f"{system_instruction}\n\n"
                f"{search_results}\n\n"
                f"USER QUESTION: {new_message}"
            )
        else:
            final_content = f"{system_instruction}\n\n[System: Search attempted but returned no results.]\n\nUSER QUESTION: {new_message}"
    else:
        final_content = f"{system_instruction}\n\nUSER QUESTION: {new_message}"

    messages_payload = history[:-1] 
    messages_payload.append({'role': 'user', 'content': final_content})

    payload = {
        "model": model_name,
        "messages": messages_payload,
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
            drana_backend.ai_full_response(chat_id, ai_full_response)

def check_and_update_tool_status(tool_id, tool_name, version_cmd):
    if not shutil.which(tool_name):
        return False, "Not Found in System PATH"
    try:
        output = subprocess.check_output(version_cmd, shell=True, stderr=subprocess.STDOUT, text=True)
        exact_version = output.strip()[:200] 
        return True, exact_version
    except Exception as e:
        return True, f"Installed but version check failed: {str(e)}"

def report_writing(data):
    prompt = read_prompts('report_writing.txt')
    prompt = prompt.replace("<<JSON_PAYLOAD>>", json.dumps(data))

    model = get_model.get_drana_model()
    raw_output = ask_to_model(model, prompt)
    return raw_output


def clean_vulnerability_json_safe(data: dict) -> dict:
    cleaned = copy.deepcopy(data)

    cleaned.pop("attack_surface_discovery", None)
    cleaned.pop("result", None)

    analysis_summary = cleaned.get("analysis_summary", {})
    analysis_summary.pop("application_type", None)
    analysis_summary.pop("assumed_user_role", None)

    for vuln in cleaned.get("vulnerabilities", []):
        vuln.pop("confidence", None)

    return cleaned

def extract_body(raw_response: str) -> str:
    raw_response = raw_response.replace("\r\n", "\n")
    parts = raw_response.split("\n\n", 1)

    if len(parts) == 2:
        return parts[1]
    else:
        return raw_response


@socketio.on('crawl_status')
def handle_crawl_status(data):
    socketio.emit('crawl_status', data)

@socketio.on('new_request_data')
def handle_new_request(data):
    project_id = data.get('project_id')
    
    if project_id and project_id != "uncategorized":
        drana_backend.save_request(project_id, data)
        socketio.emit('update_ui', data) 
    else:
        print(f"[System] Ignored request with no Project ID: {data.get('id')}")

@socketio.on('trigger_replay_in_engine')
def forward_to_engine(data):
    emit('trigger_replay_in_engine', data, broadcast=True)

@socketio.on('resend_response_update')
def forward_to_browser(data):
    emit('resend_response_update', data, broadcast=True)

@socketio.on('update_request_data')
def handle_update_request(data):
    request_id = data.get('id')
    summary = data.get('summary')
    full_data = data.get('full_data')
    
    print(f"Updating Request ID: {request_id}")
    drana_backend.update_requests_data(summary, full_data, request_id)

@socketio.on("silent_replay_request")
def forward_to_proxy(data):
    socketio.emit(
        "silent_replay_request_engine",
        data
    )

@socketio.on("silent_replay_response_engine")
def forward_back_to_client(data):
    socketio.emit(
        "silent_replay_response",
        data
    )



@drana_infinity.route('/req_analysis', methods=['POST'])
def req_analysis():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    data = request.json
    flow_id = data.get('id')  
    print(f"Analyzing Flow ID: {flow_id}")
    analysis = drana_backend.get_req_analysis(flow_id)
    if(analysis):
        print("return already existing analysis")
        analysis = json.loads(analysis)
        return jsonify(analysis)
    else:
        try:
            flow_data = drana_backend.read_req_resp_host(flow_id)

            if flow_data:
                request_text = flow_data.get('request_raw', '')
                response_text = flow_data.get('response_raw', '')
                host = flow_data.get('host', '')

                prompt = read_prompts('web_app_sec_text.txt')
                prompt = prompt.replace("<<request>>", request_text if request_text else "")
                prompt = prompt.replace("<<response>>", response_text if response_text else "")

                model = get_model.get_drana_model()
                raw_output = ask_to_model(model, prompt)
                
                parse_data = parse_markdown_json(raw_output)
                parse_data_str = json.dumps(parse_data)
                drana_backend.save_req_analysis(flow_id, parse_data_str)
                return jsonify(parse_data)
            else:
                return jsonify({"error": "Flow ID not found in database", "result": "error"}), 404

        except Exception as e:
            print(f"Error in analysis: {e}")
            return jsonify({"error": str(e), "result": "error"}), 500

@drana_infinity.route('/req_recon', methods=['POST'])
def req_recon():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    data = request.json
    flow_id = data.get('id')  
    filetype = data.get('file_type')
    print(filetype)
    print(f"Analyzing Flow ID: {flow_id}")
    recon = drana_backend.get_req_recon(flow_id)
    if(recon):
        print("return already existing recon")
        recon = json.loads(recon)
        return jsonify(recon)
    else:
        try:
            flow_data = drana_backend.read_req_resp_host(flow_id)

            if flow_data:
                request_text = flow_data.get('request_raw', '')
                response_text = flow_data.get('response_raw', '')
                host = flow_data.get('host', '')

                model = get_model.get_drana_model()

                if filetype == "javascript":
                    system_prompt = drana_prompt.js_recon_system_prompt()
                    client_prompt = drana_prompt.js_recon_client_prompt()
                    jscode = extract_body(response_text)
                                        
                    if not jscode:
                        return jsonify({"error": "No JavaScript code found", "result": "error"}), 400

                    result = js_recon.extract_js_intelligence(jscode)
                    client_prompt = client_prompt.replace("<DRANA_JS_RECON_DATA>", json.dumps(result) if result else "")
                    print(system_prompt)
                    print("\n\n\n")
                    print(client_prompt)
                    raw_output = ask_to_model_with_js(model, system_prompt, client_prompt)

                else:
                    prompt = read_prompts('single_request_response_recon.txt')
                    prompt = prompt.replace("<DRANA_REQUEST_DATA>", request_text if request_text else "")
                    prompt = prompt.replace("<DRANA_RESPONSE_DATA>", response_text if response_text else "")
                    raw_output = ask_to_model(model, prompt)
                
                
                #add raw_output in result json data as summery
                result["summary"] = raw_output
                #parse_data = parse_markdown_json(raw_output)
                parse_data_str = json.dumps(result)
                print(parse_data_str)
                drana_backend.save_req_recon(flow_id, parse_data_str)
                return jsonify(result)
            else:
                return jsonify({"error": "Flow ID not found in database", "result": "error"}), 404

        except Exception as e:
            print(f"Error in Recon: {e}")
            return jsonify({"error": str(e), "result": "error"}), 500

@drana_infinity.route('/report/<flow_id>')
def view_report(flow_id):
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    return render_template('report.html', flow_id=flow_id)

@drana_infinity.route('/report/<flow_id>/generate')
def generate_report_api(flow_id):
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    if not flow_id:
        return jsonify({"success": False, "message": "Flow ID is required"}), 400

    analysis = drana_backend.get_req_analysis(flow_id)
    if not analysis:
        return jsonify({"success": False, "message": "No analysis found"}), 404
    
    analysis = json.loads(analysis)
    json_cleaning = clean_vulnerability_json_safe(analysis)
    report_content = report_writing(json_cleaning)
    
    return jsonify({"success": True, "content": report_content})

@drana_infinity.route('/interceptor')
@drana_infinity.route('/interceptor/<project_id>')
def interceptor_view(project_id=None):
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    return render_template('interceptor.html', initial_project_id=project_id)

@drana_infinity.route('/interceptor/new', methods=['POST'])
def new_project():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    data = request.json
    project_name = data.get('name', 'Untitled Project')
    
    new_uuid = drana_backend.create_interceptor_project(project_name, user_hash)

    if new_uuid:
        CURRENT_PROJECT_UUID = new_uuid
        return jsonify({"status": "success", "project_id": new_uuid})
    else:
        return jsonify({"status": "error", "message": "Failed to create project"}), 500


@drana_infinity.route('/interceptor/projects', methods=['GET'])
def get_all_projects():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    projects = drana_backend.get_all_interceptor_projects(user_hash)
    project_list = [dict(row) for row in projects]
    return jsonify({"status": "success", "projects": project_list})

@drana_infinity.route('/interceptor/delete_project', methods=['POST'])
def delete_interceptor_project_route():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    data = request.json
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({"success": False, "message": "Missing project_id"}), 400

    drana_backend.delete_interceptor_project(project_id, user_hash)
    return jsonify({"success": True})

@drana_infinity.route('/interceptor/project/select', methods=['POST'])
def select_project():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    global CURRENT_PROJECT_UUID
    data = request.json
    project_id = data.get('id')
    
    CURRENT_PROJECT_UUID = project_id
    
    project_name = drana_backend.get_interceptor_projects(project_id)

    history = drana_backend.get_project_traffic(project_id)
    history_list = []
    
    for row in history:
        history_list.append({
            'id': row['id'],
            'type': row.get('scheme', 'http').lower(),
            'full_data': {
                'request_raw_text': row['request_raw'],
                'response_raw_text': row['response_raw'],
                'response_content': row['response_raw']
            },
            'summary': {
                'time': row['timestamp'],
                'scheme': row['scheme'],
                'method': row['method'],
                'host': row['host'],
                'path': row['path'],
                'status': row['status_code'],
                'content_type': row['content_type'],
                'size': row['size'],
                'time_taken': row['time_taken']
            }
        })

    return jsonify({
        "status": "success", 
        "project_id": project_id, 
        "project_name": project_name, 
        "history": history_list
    })

@drana_infinity.route('/start_subdomain_interception', methods=['POST'])
def start_subdomain_interception():
    user_hash = request.cookies.get('user_hash')
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)
    if not user_info:
        return jsonify({"success": False, "message": "Invalid session"}), 401
        
    data = request.json
    target_name = data.get('target_name')
    subdomains = data.get('subdomains', [])
    node_id = data.get('node_id')
    
    if not target_name or not subdomains:
        return jsonify({"success": False, "message": "Target name and subdomains required"}), 400
        
    # Check if this node is already linked to an interceptor project
    existing_id = None
    if node_id:
        existing_id = drana_backend.get_linked_interceptor_project(node_id)
    
    # If not linked, fallback to check by name? NO, user explicitly said NOT by name.
    # But if existing_id is valid, use it.
    
    if existing_id:
        return jsonify({
            "success": True, 
            "message": f"Opened existing linked project for '{target_name}'",
            "project_id": existing_id
        })
    else:
        # Create new project
        project_id = drana_backend.create_interceptor_project(target_name, user_hash)
        if not project_id:
            return jsonify({"success": False, "message": "Failed to create project"}), 500
            
        if node_id:
            drana_backend.link_node_to_interceptor(node_id, project_id)
            
        msg_prefix = "Created new project"
        
        try:
            fd, temp_path = tempfile.mkstemp(suffix='.txt', text=True)
            with os.fdopen(fd, 'w') as tmp:
                for sub in subdomains:
                    if not sub.startswith('http'):
                        tmp.write(f'http://{sub}\n')
                    else:
                        tmp.write(f'{sub}\n')
                        
            cmd = [
                sys.executable, 
                os.path.join(os.path.dirname(__file__), 'proxy_crawler.py'),
                '--mode', 'list',
                '--input-file', temp_path,
                '--project-id', project_id
            ]
            
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            return jsonify({
                "success": True, 
                "message": f"{msg_prefix} and queued {len(subdomains)} subdomains for interception on '{target_name}'",
                "project_id": project_id
            })
            
        except Exception as e:
            print(f"Error starting interception: {e}")
            return jsonify({"success": False, "message": str(e)}), 500

@drana_infinity.route('/')
def index():
    return render_template('index.html', page_mode='chats', active_project_id=None, active_project_title=None)

@drana_infinity.route('/projects')
def projects_page():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    return render_template('index.html', page_mode='projects', active_project_id=None, active_project_title=None)

@drana_infinity.route('/project/<project_id>')
def project_detail_page(project_id):
    user_hash = request.cookies.get('user_hash')
    project_title = "Project" 
    if user_hash:
        try:
            project_title = drana_backend.read_interceptor_project_data(project_id, user_hash)
        except Exception as e:
            print(e)
            project_title = "Error"
    return render_template('index.html', page_mode='project_detail', active_project_id=project_id, active_project_title=project_title)

@drana_infinity.route('/save_node', methods=['POST'])
def save_node():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    data = request.json
    try:
        drana_backend.save_node_info(data)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error saving node: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@drana_infinity.route('/delete_node', methods=['POST'])
def delete_node():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    node_id = request.json.get("node_id")
    project_id = request.json.get("project_id")
    if not node_id or not project_id:
        return jsonify({"success": False, "message": "Missing node_id or project_id"}), 400
    
    try:
        drana_backend.delete_node(node_id, project_id)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error deleting node: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@drana_infinity.route('/get_graph_nodes', methods=['GET'])
def get_graph_nodes():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    project_id = request.args.get('project_id')
    if not project_id: return jsonify({"success": False})

    nodes = drana_backend.get_node_data(project_id)
    return jsonify({"success": True, "nodes": nodes})

@drana_infinity.route('/upload_file', methods=['POST'])
def upload_file():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

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
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    chat_upload_dir = os.path.join(drana_infinity.config['UPLOAD_FOLDER'], chat_id)
    return send_from_directory(chat_upload_dir, filename)

@drana_infinity.route('/execute_stream', methods=['POST'])
def execute_stream():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    command = request.json.get("command")
    chat_id = request.json.get("chat_id")
    output_id = request.json.get("output_id")
    if not all([command, chat_id, output_id]):
        return jsonify({"success": False, "message": "Missing required data."}), 400
    
    output_queue = command_executor.execute(command)
    
    full_output = "" 

    def generate_and_save():
        nonlocal full_output
        while True:
            line = output_queue.get()
            if line is None:
                break
            full_output += line
            yield line
        
        drana_backend.save_execute_stream_data(output_id, chat_id, command, full_output)

    return Response(stream_with_context(generate_and_save()), mimetype="text/plain")

@drana_infinity.route('/execute_scan_stream', methods=['POST'])
def execute_scan_stream():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    target = request.json.get("command")
    cmdtype = request.json.get("scanType")
    model = request.json.get("model")
    
    print(f"[*] Executing scan on target: {target} of type {cmdtype} with model {model}")
    
    if not target:
        return jsonify({"success": False, "message": "No target provided."}), 400

    default_cmds = read_default_cmds(cmdtype)

    parse_data = {'detected': False}
    data=""
    cmd_output=""
    multiline=True

    for i in range(1, len(default_cmds)+1):
        print(i)
        if str(i) not in default_cmds:
            return jsonify({"success": False, "message": f"Command type {cmdtype} not found."}), 400

        command = default_cmds[str(i)]["command"]
        query = default_cmds[str(i)]["prompt"]
        command = command.replace("<target>", target)
        mts = default_cmds[str(i)]["mslec"]
        if mts == 1:
            multiline = True
        else:
            multiline = False

        if query:
            output = default_cmds[str(i)]["output"]
            rslt = default_cmds[str(i)]["result"]
            
            cmd_output = command_executor.execute(command)

            query = query.replace("OUTPUT_HERE", cmd_output)

            raw_output = ask_to_model(model, query)
            parse_data = parse_markdown_json(raw_output)
            print(parse_data)
            data = ""
            if parse_data['detected'] is True:
                for data_value in parse_data[output]:
                    data = data+data_value + "\n"
                break
        else:
            rslt = command_executor.execute(command)
            cmd_output = rslt

    if parse_data['detected'] is False:
        data = rslt

    def generate():
        response_payload = {
            "filteredLines": data,        
            "fullLog": cmd_output,        
            "multiline": multiline        
        }
        
        yield json.dumps(response_payload)

    return Response(stream_with_context(generate()), mimetype="text/plain")

@drana_infinity.route('/execute_manual_node_ai', methods=['POST'])
def execute_manual_node_ai():
    user_hash = request.cookies.get('user_hash')
    if not user_hash: return jsonify({"success": False, "message": "Unauthorized"}), 401
    user_info = drana_backend.get_user_info(user_hash)
    if not user_info: return jsonify({"success": False, "message": "Invalid session"}), 401

    data = request.json
    description = data.get("description")
    label = data.get("label")
    ancestors = data.get("ancestors", [])
    project_id = data.get("projectId")
    model = data.get("model", "llama3")

    if not description:
        return jsonify({"success": False, "message": "No description provided."}), 400

    # Format Ancestry
    ancestry_str = ""
    for i, anc in enumerate(ancestors):
        anc_content = anc.get('content', '')
        if isinstance(anc_content, list):
            anc_content = anc_content[0] if anc_content else ""
        elif isinstance(anc_content, str) and "\n" in anc_content:
            anc_content = anc_content.split("\n")[0]
            
        ancestry_str += f"Level {i+1} [{anc.get('type')}]: {anc.get('header')} - {anc_content}\n"
        
    if not ancestry_str:
        ancestry_str = "No parent context (Root level node)"

    # Format Project Context
    project_context = "Unknown Project"
    if project_id:
        proj_info = drana_backend.read_interceptor_project_data(project_id, user_hash)
        if proj_info:
            project_context = proj_info

    cmd_prompt_template = read_prompts('manual_node_command_gen.txt')
    
    previous_errors = ""
    command_to_run = ""
    cmd_output = ""
    full_llm_log = ""
    success = False
    
    for attempt in range(5):
        cmd_prompt = cmd_prompt_template.replace("<<user_description>>", description)
        cmd_prompt = cmd_prompt.replace("<<ancestry_chain>>", ancestry_str)
        cmd_prompt = cmd_prompt.replace("<<project_context>>", str(project_context))
        cmd_prompt = cmd_prompt.replace("<<previous_errors>>", previous_errors)

        print(f"\n[AI CMD GEN] Attempt {attempt + 1} Prompt:\n{'-'*40}\n{cmd_prompt}\n{'-'*40}\n")
        raw_cmd_output = ask_to_model(model, cmd_prompt)
        print(f"\n[AI CMD GEN] Attempt {attempt + 1} Output:\n{'-'*40}\n{raw_cmd_output}\n{'-'*40}\n")
        
        full_llm_log += f"\n--- Attempt {attempt + 1} Command Generation ---\n{raw_cmd_output}\n"

        try:
            parsed_cmd = parse_markdown_json(raw_cmd_output)
            command_to_run = parsed_cmd.get("command", "")
        except Exception as e:
            command_to_run = ""
            previous_errors += f"\nAttempt {attempt + 1} Failed: LLM did not return valid JSON for the command. Error: {e}"
            continue

        if not command_to_run:
            previous_errors += f"\nAttempt {attempt + 1} Failed: Generated command was empty."
            continue

        success, cmd_output = command_executor.execute_with_status(command_to_run)
        full_llm_log += f"\n--- Attempt {attempt + 1} Execution Output ---\n{cmd_output}\n"

        if success:
            break
        else:
            previous_errors += f"\nAttempt {attempt + 1} Command '{command_to_run}' Failed with output:\n{cmd_output[:1000]}"

    if not command_to_run or not success:
        return jsonify({"success": False, "message": "Failed to generate a working command after 5 attempts.", "fullLog": full_llm_log + "\n" + previous_errors}), 500

    filter_prompt_template = read_prompts('manual_node_output_filter.txt')
    filter_prompt = filter_prompt_template.replace("<<user_description>>", description)
    filter_prompt = filter_prompt.replace("<<command_output>>", cmd_output[:5000])

    raw_filter_output = ask_to_model(model, filter_prompt)
    if "no results" in raw_filter_output.lower() and "{" not in raw_filter_output:
        return jsonify({
            "filteredLines": "No Results",
            "fullLog": f"Command executed: {command_to_run}\n\n{cmd_output}",
            "command": command_to_run,
            "multiline": False
        })

    try:
        # Provide strict=False in case the LLM outputs unescaped control characters (e.g. \n) inside the JSON string
        match = re.search(r'\{.*\}', raw_filter_output, re.DOTALL)
        if match:
            json_str = match.group(0)
            parsed_filter = json.loads(json_str, strict=False)
        else:
            parsed_filter = json.loads(raw_filter_output, strict=False)
            
        filtered_lines = parsed_filter.get("filtered_output", "")
        if isinstance(filtered_lines, list):
            filtered_lines = "\n".join(str(v) for v in filtered_lines)
    except Exception as e:
        print(f"Failed to parse filter JSON: {e}. Falling back to raw text.")
        # Fallback to returning the raw text if the LLM failed to format it as JSON correctly
        filtered_lines = raw_filter_output.strip()

        # If the LLM still wrapped it in some markdown JSON block, strip it
        if filtered_lines.startswith("```json"):
            filtered_lines = filtered_lines.replace("```json", "", 1)
            if filtered_lines.endswith("```"):
                filtered_lines = filtered_lines[:-3]
        filtered_lines = filtered_lines.strip()

    return jsonify({
        "filteredLines": filtered_lines,
        "fullLog": f"Command executed: {command_to_run}\n\n{cmd_output}",
        "command": command_to_run,
        "multiline": "\n" in filtered_lines if filtered_lines else False
    })

@drana_infinity.route('/node_data', methods=['POST'])
def node_data():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    node_id = request.json.get("node_id")
    if not node_id:
        return jsonify({"success": False, "message": "Node ID not provided."}), 400

    result = drana_backend.fetch_node_data(node_id)
    if result:
        node_payload = {
            "node_id": result[0],
            "project_id": result[1],
            "parent_id": result[2],
            "label": result[3],
            "type": result[4],
            "content": result[5],
            "full_log": result[6],
            "command": result[7],
            "status": result[8],
            "multiline": result[9]
        }

        return jsonify({"success": True, "data": node_payload})
    else:
        return jsonify({"success": False, "message": "Node not found."}), 404


@drana_infinity.route('/get_command_output', methods=['POST'])
def get_command_output():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    output_id = request.json.get("output_id")
    if not output_id:
        return jsonify({"success": False, "message": "Output ID not provided."}), 400

    result = drana_backend.get_command_output(output_id)
    if result:
        return jsonify({"success": True, "command": result[0], "output": result[1]})
    else:
        return jsonify({"success": False, "message": "Output not found."}), 404

def get_tool_config(tool_id=None):
    if not os.path.exists(TOOLS_FILE):
        return [] if tool_id is None else None
        
    with open(TOOLS_FILE, 'r') as f:
        tools = json.load(f)
        
    if tool_id is not None:
        return next((item for item in tools if item["id"] == tool_id), None)
        
    return tools

@drana_infinity.route('/api/check_tool/<int:tool_id>', methods=['POST'])
def check_single_tool(tool_id):
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    tool_config = get_tool_config(tool_id)
    
    if not tool_config:
        return jsonify({"error": "Tool not found"}), 404

    is_installed, detected_version = check_and_update_tool_status(
        tool_config['id'], 
        tool_config['tool_name'], 
        tool_config['version_command']
    )

    return jsonify({
        "id": tool_config['id'],
        "name": tool_config['tool_name'],
        "version": detected_version,
        "installed": is_installed,
        "link": tool_config['install_link']
    })

@drana_infinity.route('/required_tools')
def required_tools():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    tools = get_tool_config()
    return render_template('tools.html', tools_data=tools)

@drana_infinity.route('/login', methods=['POST'])
def login():
    username = request.json.get("username")
    if not username:
        return jsonify({"success": False, "message": "Username not provided."}), 400
    user_hash = hashlib.sha256(secrets.token_bytes(32)).hexdigest()

    existing_user = drana_backend.check_user_info(username)
    if existing_user:
        user_hash = existing_user[0]
    else:
        drana_backend.create_user(username, user_hash)

    response = make_response(jsonify({"success": True, "user_hash": user_hash, "username": username}))
    response.set_cookie('user_hash', user_hash, max_age=60*60*24*365) 
    return response

@drana_infinity.route('/get_user_info', methods=['GET'])
def get_user_info():
    user_hash = request.cookies.get('user_hash')
    if not user_hash:
        return jsonify({"success": False, "message": "User hash not found."}), 401

    user_info = drana_backend.get_user_info(user_hash)
    if user_info:
        return jsonify({"success": True, "username": user_info[0]})
    else:
        return jsonify({"success": False, "message": "User not found."}), 404

@drana_infinity.route('/get_chats', methods=['GET'])
def get_chats():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    project_id = request.args.get('project_id')
    if not project_id or project_id == 'null' or project_id == 'None':
        project_id = None

    chat_list = drana_backend.get_chats_for_user(user_hash, project_id)
    return jsonify({"success": True, "chats": chat_list})

@drana_infinity.route('/get_chat_messages', methods=['POST'])
def get_chat_messages():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    chat_id = request.json.get("chat_id")
    if not chat_id:
        return jsonify({"success": False, "message": "Chat ID not provided."}), 400

    messages = drana_backend.get_chat_msg_for_user(chat_id)
    return jsonify({"success": True, "messages": messages})

@drana_infinity.route('/rename_chat', methods=['POST'])
def rename_chat():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    chat_id = request.json.get("chat_id")
    new_title = request.json.get("new_title")
    user_hash = request.cookies.get('user_hash')
    if not all([chat_id, new_title, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400

    drana_backend.rename_user_chat(chat_id, new_title, user_hash)
    return jsonify({"success": True})

@drana_infinity.route('/delete_chat', methods=['POST'])
def delete_chat():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    chat_id = request.json.get("chat_id")
    user_hash = request.cookies.get('user_hash')
    if not all([chat_id, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400

    drana_backend.delete_user_chat(chat_id, user_hash)
    return jsonify({"success": True})
    
@drana_infinity.route('/create_new_chat', methods=['POST'])
def create_new_chat():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    model_name = request.json.get("model_name")
    project_id = request.json.get("project_id") 
    if not model_name:
        return jsonify({"success": False, "message": "Missing user hash or model name."}), 400
    if not project_id or project_id == 'null' or project_id == 'None':
        project_id = None
    chat_id = str(uuid.uuid4())
    default_title = "New Chat"

    drana_backend.create_new_user_chat(chat_id, user_hash, default_title, model_name, project_id)
    return jsonify({"success": True, "chat_id": chat_id, "title": default_title, "model_name": model_name})

@drana_infinity.route('/chat_stream', methods=['POST'])
def chat_stream():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    user_message = request.json.get("message")
    chat_id = request.json.get("chat_id")
    model_name = request.json.get("model_name")
    user_hash = request.cookies.get('user_hash')
    file_path = request.json.get("file_path")
    file_name = request.json.get("file_name")
    use_search = request.json.get("use_search", False) 

    if not all([user_message, chat_id, model_name, user_hash]):
        return jsonify({"response": "Missing chat data."}), 400

    drana_backend.save_user_chat_history(chat_id, user_message, file_path, file_name)
    history = drana_backend.get_chat_history_for_ollama(chat_id)
    return Response(stream_with_context(stream_ollama_response(model_name, history, user_message, chat_id, use_search)), mimetype="text/plain")

@drana_infinity.route('/get_models', methods=['GET'])
def get_models():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401
        
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

    project_list = drana_backend.get_user_project_info(user_hash)
    return jsonify({"success": True, "projects": project_list})

@drana_infinity.route('/create_new_project', methods=['POST'])
def create_new_project():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    project_name = request.json.get("project_name")
    project_type = request.json.get("project_type", "")
    if not project_name:
        return jsonify({"success": False, "message": "Missing project name."}), 400
    project_id = str(uuid.uuid4())

    drana_backend.create_new_project_user(project_id, user_hash, project_name, project_type)
    return jsonify({"success": True, "project_id": project_id, "title": project_name, "type": project_type})

@drana_infinity.route('/rename_project', methods=['POST'])
def rename_project():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    project_id = request.json.get("project_id")
    new_title = request.json.get("new_title")
    if not all([project_id, new_title, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400

    drana_backend.rename_user_project(project_id, new_title, user_hash)
    return jsonify({"success": True})

@drana_infinity.route('/delete_project', methods=['POST'])
def delete_project():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    project_id = request.json.get("project_id")
    if not all([project_id, user_hash]):
        return jsonify({"success": False, "message": "Missing required data."}), 400

    drana_backend.delete_user_project(project_id, user_hash)
    return jsonify({"success": True})

def monitor_crawler_process(cmd):
    try:
        process = subprocess.Popen(cmd)
        process.wait()
        
        socketio.emit('crawl_status', {
            'status': 'complete', 
            'message': 'Operation Completed Successfully'
        })
    except Exception as e:
        print(f"Crawler Error: {e}")

@drana_infinity.route('/start_crawler', methods=['POST'])
def start_crawler():
    user_hash = request.cookies.get('user_hash')
    
    if not user_hash:
        return jsonify({"success": False, "message": "Unauthorized: Login required"}), 401
    
    user_info = drana_backend.get_user_info(user_hash)

    if not user_info:
        return jsonify({"success": False, "message": "Unauthorized: Invalid or expired session"}), 401

    data = request.json
    target_url = data.get('target')
    mode = data.get('mode')
    
    project_id = data.get('project_id') 

    if not target_url or not project_id:
        return jsonify({"success": False, "message": "Missing URL or Project ID"})

    try:
        subprocess.Popen([
            "python3", "proxy_crawler.py", 
            target_url, 
            "--mode", mode, 
            "--project-id", project_id
        ])
        return jsonify({"success": True, "message": "Crawler started"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

if __name__ == '__main__':
    ensure_browser_setup()
    try:
        drana_backend.init_db()
    except sqlite3.OperationalError as e:
        print("Database already initialized:", e)

    start_proxy_engine()

    print("Drana-Infinity server is running on ::: http://127.0.0.1:80")
    
    try:
        socketio.run(drana_infinity, host='127.0.0.1', port=80, debug=False)
    except KeyboardInterrupt:
        stop_proxy_engine()
