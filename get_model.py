import subprocess

def get_drana_model():
    priority_models = [
        "IHA089/drana-infinity-7b:7b",
        "IHA089/drana-infinity-3b:3b",
        "IHA089/drana-infinity-1.5b:1.5b",
    ]

    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            check=True
        )

        installed = result.stdout

        for model in priority_models:
            if model in installed:
                return model  

        return None  

    except FileNotFoundError:
        return "ollama_not_installed"

    except Exception as e:
        return f"error: {str(e)}"

