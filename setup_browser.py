import os
import shutil
import zipfile
import stat
import sys
import requests

VERSION = "143.0.7499.169"
BASE_URL = f"https://storage.googleapis.com/chrome-for-testing-public/{VERSION}/linux64"
CHROME_ZIP = "chrome-linux64.zip"
DRIVER_ZIP = "chromedriver-linux64.zip"

CHROME_URL = f"{BASE_URL}/{CHROME_ZIP}"
DRIVER_URL = f"{BASE_URL}/{DRIVER_ZIP}"

def download_file(url, filename):
    print(f"[+] Downloading {filename}...")
    try:
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            downloaded = 0
            
            with open(filename, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = int((downloaded / total_size) * 100)
                        sys.stdout.write(f"\r    Progress: {percent}%")
                        sys.stdout.flush()
            print() 
    except Exception as e:
        print(f"\n[-] Error downloading {url}: {e}")
        sys.exit(1)

def set_executable(path):
    st = os.stat(path)
    os.chmod(path, st.st_mode | stat.S_IEXEC)

def main():
    print(f"[*] Setting up Portable Chrome Environment (Version {VERSION})...")
    
    download_file(CHROME_URL, CHROME_ZIP)
    download_file(DRIVER_URL, DRIVER_ZIP)

    print("[+] Extracting Chrome Browser...")
    with zipfile.ZipFile(CHROME_ZIP, 'r') as zip_ref:
        zip_ref.extractall(".")

    print("[+] Extracting ChromeDriver...")
    with zipfile.ZipFile(DRIVER_ZIP, 'r') as zip_ref:
        zip_ref.extractall(".")

    print("[+] Positioning files...")
    
    source_driver_folder = "chromedriver-linux64"
    source_driver_bin = os.path.join(source_driver_folder, "chromedriver")
    dest_driver = "chromedriver"
    
    if os.path.exists(source_driver_bin):
        if os.path.exists(dest_driver):
            os.remove(dest_driver)
        shutil.move(source_driver_bin, dest_driver)
    else:
        print("[-] Error: chromedriver binary not found in extracted folder.")
        sys.exit(1)

    print("[+] Cleaning up temporary files...")
    if os.path.exists(CHROME_ZIP): os.remove(CHROME_ZIP)
    if os.path.exists(DRIVER_ZIP): os.remove(DRIVER_ZIP)
    if os.path.exists(source_driver_folder): shutil.rmtree(source_driver_folder)

    print("[+] Setting recursive executable permissions (755)...")
    chrome_dir = "chrome-linux64"
    chrome_bin = os.path.join(chrome_dir, "chrome")
    
    try:
        if os.path.exists(chrome_dir):
            for root, dirs, files in os.walk(chrome_dir):
                for momo in dirs:
                    os.chmod(os.path.join(root, momo), 0o755)
                for momo in files:
                    os.chmod(os.path.join(root, momo), 0o755)
        
        if os.path.exists(dest_driver):
            os.chmod(dest_driver, 0o755)
    except Exception as e:
        print(f"[-] Warning: Could not set all permissions: {e}")

    print("-" * 50)
    print("[✔] SUCCESS! Environment is ready.")
    print(f"    - Browser: {os.path.abspath(chrome_bin)}")
    print(f"    - Driver:  {os.path.abspath(dest_driver)}")

if __name__ == "__main__":
    main()
