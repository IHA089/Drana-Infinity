import sys
import os
import time
import argparse
import subprocess
import shutil
import socketio
from collections import deque
from urllib.parse import urljoin, urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.by import By


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CHROME_BIN = os.path.join(SCRIPT_DIR, "chrome-linux64", "chrome")
DRIVER_BIN = os.path.join(SCRIPT_DIR, "chromedriver")

import warnings
try:
    from requests.exceptions import RequestsDependencyWarning
    warnings.filterwarnings("ignore", category=RequestsDependencyWarning)
except ImportError:
    pass

PROXY_HOST = "127.0.0.1"
PROXY_PORT = "8080" 

def setup_driver(headless=True, specific_agent=None, project_id=None):
    if not os.path.exists(CHROME_BIN):
        print(f"[-] Error: Portable Chrome binary not found at: {CHROME_BIN}")
        sys.exit(1)
    if not os.path.exists(DRIVER_BIN):
        print(f"[-] Error: Local ChromeDriver not found at: {DRIVER_BIN}")
        sys.exit(1)
    
    print(f"[*] Using Portable Chrome: {CHROME_BIN}")
    
    if os.path.exists(DRIVER_BIN):
        if not os.access(DRIVER_BIN, os.X_OK):
            os.chmod(DRIVER_BIN, 0o755)

    if project_id:
        profile_dir = os.path.join(SCRIPT_DIR, "chrome_profiles", f"profile-{project_id}")
    else:
        profile_dir = os.path.join(SCRIPT_DIR, "chrome_profiles", "default-proxy-profile")
    
    if not os.path.exists(profile_dir):
        os.makedirs(profile_dir, exist_ok=True)
    
    options = Options()
    options.binary_location = CHROME_BIN
    
    if headless:
        options.add_argument('--headless=new') 
    
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-setuid-sandbox')
    options.add_argument('--disable-zygote')
    options.add_argument('--disable-dev-shm-usage') 
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-software-rasterizer')
    options.add_argument('--disable-extensions')
    options.add_argument(f'--user-data-dir={profile_dir}')
    options.add_argument(f'--proxy-server={PROXY_HOST}:{PROXY_PORT}')

    
    base_ua = specific_agent if specific_agent else "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    
    if project_id:
        final_ua = f"{base_ua} DranaProject/{project_id}"
    else:
        final_ua = base_ua
        
    options.add_argument(f'--user-agent={final_ua}')
    options.add_argument('--ignore-certificate-errors')
    options.add_argument('--ignore-ssl-errors')
    options.add_argument("--log-level=3") 

    service = Service(executable_path=DRIVER_BIN)
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def normalize_url(url):
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

def mode_visit_single(url, project_id):
    driver = setup_driver(headless=True, project_id=project_id)
    try:
        driver.get(url)
        time.sleep(2) 
    except Exception as e:
        print(f"[-] Error: {e}")
    finally:
        driver.quit()

def mode_open_browser(url, project_id):
    driver = setup_driver(headless=False, project_id=project_id)
    try:
        driver.get(url)
        print("[*] Browser Open. Monitoring...")
        while True:
            if not driver.window_handles: break
            time.sleep(1)
    except Exception: pass
    finally:
        try: driver.quit()
        except: pass

def mode_crawl_recursive(start_url, project_id):
    driver = setup_driver(headless=True, project_id=project_id)
    parsed_start = urlparse(start_url)
    domain = parsed_start.netloc
    
    queue = deque([start_url])
    visited_normalized = set()
    
    try:
        while queue:
            current_url = queue.popleft()
            norm_url = normalize_url(current_url)
            if norm_url in visited_normalized: continue
            
            try:
                print(f"[*] Visiting: {current_url}")
                driver.get(current_url)
                time.sleep(1.5)
                visited_normalized.add(norm_url)
                
                elements = driver.find_elements(By.TAG_NAME, "a")
                for elem in elements:
                    try:
                        href = elem.get_attribute("href")
                        if href and urlparse(href).netloc == domain:
                            if normalize_url(href) not in visited_normalized:
                                queue.append(href)
                    except: continue
            except Exception as e:
                print(f"[-] Error: {e}")
    finally:
        driver.quit()

def mode_pipe_katana(target_url, project_id): 
    if not shutil.which("katana"):
        print("[-] Katana not found. Ensure it's in your PATH.")
        sys.exit(1)

    custom_ua = "Mozilla/5.0 (X11; Linux x86_64) Drana-Katana-Crawler"
    driver = setup_driver(headless=True, specific_agent=custom_ua, project_id=project_id)
    
    cmd = ["katana", "-u", target_url, "-silent", "-H", f"X-Drana-Project: {project_id}"]

    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1, universal_newlines=True)
        
        for line in process.stdout:
            url = line.strip()
            if not url or not url.startswith("http"): continue
            
            try:
                driver.get(url)
                print(f"[+] Katana+Selenium: {url}")
            except Exception: pass
            
        process.wait()
    finally:
        driver.quit()

def mode_visit_list(input_file, project_id):
    if not os.path.exists(input_file):
        print(f"[-] Input file not found: {input_file}")
        return

    driver = setup_driver(headless=True, project_id=project_id)
    try:
        with open(input_file, 'r') as f:
            urls = [line.strip() for line in f if line.strip()]
        
        print(f"[*] Visiting {len(urls)} URLs from list...")
        
        for url in urls:
            if not url.startswith('http'):
                url = 'http://' + url
            
            try:
                print(f"[*] Visiting: {url}")
                driver.get(url)
                time.sleep(3) # Wait for traffic
            except Exception as e:
                print(f"[-] Error visiting {url}: {e}")
                
            # Optional: Clear cookies between domains if strict isolation needed
            # driver.delete_all_cookies() 
            
    except Exception as e:
        print(f"[-] Error in list mode: {e}")
    finally:
        driver.quit()
        # Clean up temp file if needed, but handled by caller usually

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs='?')
    parser.add_argument("--mode", choices=['single', 'browser', 'crawl', 'katana', 'list'], default='single')
    parser.add_argument("--project-id", required=True, help="UUID of the active project")
    parser.add_argument("--input-file", help="Path to input file for list mode")

    args = parser.parse_args()

    # URL is required unless mode is list
    if not args.url and args.mode != 'list':
        print("[-] URL Required")
        sys.exit(1)

    if args.mode == 'single':
        mode_visit_single(args.url, args.project_id)
    elif args.mode == 'browser':
        mode_open_browser(args.url, args.project_id)
    elif args.mode == 'crawl':
        mode_crawl_recursive(args.url, args.project_id)
    elif args.mode == 'katana':
        mode_pipe_katana(args.url, args.project_id)
    elif args.mode == 'list':
        if not args.input_file:
            print("[-] --input-file required for list mode")
            sys.exit(1)
        mode_visit_list(args.input_file, args.project_id)

    try:
        sio = socketio.Client()
        sio.connect('http://127.0.0.1:80') 
        sio.emit('crawl_status', {'status': 'complete'})
        time.sleep(0.5) 
        sio.disconnect()
    except Exception as e:
        pass

if __name__ == "__main__":
    main()
