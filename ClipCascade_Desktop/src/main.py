#!/usr/bin/env python3

# ClipCascade - A seamless clipboard syncing utility
# Repository: https://github.com/Sathvik-Rao/ClipCascade
#
# Author: Sathvik Rao Poladi
# License: GPL-3.0
#
# This script serves as the entry point for the ClipCascade application,
# initializing and running the core application logic.

from core.application import Application
from utils.window_icon import set_windows_app_user_model_id


class Main:
    def __init__(self):
        set_windows_app_user_model_id()
        Application().run()

def main():
    Main()

if __name__ == "__main__":
    main()
