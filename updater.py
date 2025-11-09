#!/usr/bin/env python3
"""
Drana-Infinity Auto Updater
---------------------------
Designed and maintained by IHA089.
"""

import os
from git import Repo, GitCommandError

def update_drana_infinity(repo_dir: str = "."):
    print("\n|──(Checking for Drana-Infinity Updates)──|")

    if not os.path.exists(os.path.join(repo_dir, ".git")):
        print("This directory is not a Git repository. Skipping update check.")
        return False

    try:
        repo = Repo(repo_dir)
        origin = repo.remotes.origin
        origin.fetch()

        local_commit = repo.head.commit.hexsha
        remote_commit = origin.refs.main.commit.hexsha

        if local_commit != remote_commit:
            print(f"Update found!")
            try:
                repo.git.stash('save', '--include-untracked', 'Auto-stash before update')
            except GitCommandError:
                pass

            print("Pulling latest version from GitHub...")
            origin.pull('main')

            try:
                repo.git.stash('pop')
            except GitCommandError:
                pass  

            print("Drana-Infinity successfully updated!")
            return True
        else:
            print(" Already up to date. No updates available.")
            return False

    except GitCommandError as e:
        print(f"Git error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False


if __name__ == "__main__":
    update_drana_infinity()
