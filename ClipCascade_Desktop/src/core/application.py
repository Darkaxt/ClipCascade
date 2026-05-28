import logging
import sys


from core.constants import *

from core.config import Config
from utils.request_manager import RequestManager
from utils.cipher_manager import CipherManager
from utils.client_enrollment import enroll_client
from utils.auth_recovery import clear_rejected_api_auth
from utils.activity_log import ActivityLog
from stomp_ws.stomp_manager import STOMPManager
from p2p.p2p_manager import P2PManager

if PLATFORM == WINDOWS:
    import ctypes
elif PLATFORM == MACOS or PLATFORM.startswith(LINUX):
    import fcntl


if PLATFORM.startswith(LINUX) and LINUX_USE_CLI_UI:
    import pyfiglet
    from cli.login import LoginForm
    from cli.info import CustomDialog
    from cli.tray import TaskbarPanel
    from cli.message_box import MessageBox
    from cli.echo import Echo
else:
    from gui.login import LoginForm
    from gui.info import CustomDialog
    from gui.tray import TaskbarPanel
    from gui.message_box import MessageBox


class Application:
    def __init__(
        self,
        log_file_path=LOG_FILE_NAME,
        data_file_path=DATA_FILE_NAME,
        mutex_identifier=MUTEX_NAME,
    ):
        try:
            self.log_file_path = os.path.join(
                get_program_files_directory(), log_file_path
            )
            self.data_file_path = os.path.join(
                get_program_files_directory(), data_file_path
            )
            self.mutex_identifier = mutex_identifier

            if PLATFORM == MACOS or PLATFORM.startswith(LINUX):
                self.lock_file = None  # File(lock) object
                self.mutex_identifier = os.path.join(
                    get_program_files_directory(), self.mutex_identifier
                )

            self.config = Config(
                file_name=self.data_file_path
            )  # Maintain a single configuration instance for the entire application lifecycle.

            self.activity_log = ActivityLog(max_rows=50)
            self.request_manager = RequestManager(self.config)
            self.stomp_manager = STOMPManager(self.config, activity_log=self.activity_log)
            self.p2p_manager = P2PManager(self.config, activity_log=self.activity_log)
            self.cipher_manager = CipherManager(self.config)
        except Exception as e:
            CustomDialog(
                f"An error occurred during application initialization: {e}",
                msg_type="error",
            ).mainloop()

    def setup_logging(self):
        LOG_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
        logging.basicConfig(
            level=LOG_LEVEL,
            format=LOG_FORMAT,
            filename=self.log_file_path,
            filemode="w",
        )

    def ensure_single_instance(self):
        if PLATFORM == WINDOWS:
            ctypes.windll.kernel32.CreateMutexW(None, False, self.mutex_identifier)
            if ctypes.windll.kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
                CustomDialog(
                    "Another instance of ClipCascade is already running.",
                    msg_type="warning",
                ).mainloop()
                sys.exit(0)
        elif PLATFORM == MACOS or PLATFORM.startswith(LINUX):
            if PLATFORM == MACOS:
                app_dir = get_program_files_directory()
                if not os.path.exists(app_dir):
                    try:
                        os.makedirs(app_dir)
                    except Exception as e:
                        CustomDialog(
                            f"An error occurred while creating the directory '{app_dir}'. Error: {e}",
                            msg_type="error",
                        ).mainloop()
                        sys.exit(1)

            # Create the lock file
            try:
                self.create_lock_file()
            except IOError:
                run_anyway = MessageBox().askquestion(
                    "ClipCascade",
                    "Another instance of ClipCascade is already running. Do you want to run anyway?",
                )
                if run_anyway == "yes":
                    os.remove(self.mutex_identifier)
                    self.create_lock_file()
                else:
                    self.lock_file = None
                    sys.exit(0)

    def create_lock_file(self, path=None):
        if path is None:
            path = self.mutex_identifier

        if PLATFORM == MACOS or PLATFORM.startswith(LINUX):
            self.lock_file = open(path, "w")
            fcntl.flock(self.lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)

    def authenticate_and_connect(self):
        # Attempt to connect with an existing session cookie or API key.
        if self.config.data.get("cookie") or self.config.data.get("api_key"):
            validation_result = self.request_manager.validate_session_result()
            if validation_result.valid is False and self.request_manager.has_api_key():
                self._clear_rejected_api_auth(validation_result.summary())
            else:
                try:
                    self._configure_encryption_key()
                    self._configure_server_connection()
                    ws_conn_successful, msg = self._get_ws_manager().connect()
                    if ws_conn_successful:
                        self._get_ws_manager().is_login_phase = False
                        return
                except Exception as e:
                    logging.warning(f"Saved authentication could not connect: {e}")

        # enable login form
        used_saved_credentials = False
        display_login_success_dialog = False
        if PLATFORM.startswith(LINUX) and LINUX_USE_CLI_UI:
            Echo("═" * 14 + "\n║ LOGIN FORM ║\n" + "═" * 14)
        while True:
            if (
                self.config.data.get("cookie") is not None
                and self.config.data["save_password"]
                and self.config.data["cipher_enabled"] == False
                and not used_saved_credentials
            ):
                # Attempt to connect with password when using saved credentials
                used_saved_credentials = True
            else:
                display_login_success_dialog = True
                self.config.data["password"] = ""  # Clear the password
                login_form = LoginForm(
                    self.config,
                    on_quit_callback=(
                        None
                        if (PLATFORM.startswith(LINUX) and LINUX_USE_CLI_UI)
                        else lambda: sys.exit(0)
                    ),
                )
                login_form.mainloop()  # wait until login form is closed
                raw_password = self.config.data[
                    "password"
                ]  # Store the raw password temporarily for hashing
                if raw_password and self.request_manager.has_api_key():
                    validation_result = self.request_manager.validate_session_result()
                    if validation_result.valid is False:
                        self._clear_rejected_api_auth(validation_result.summary())

                if raw_password and not self.request_manager.has_api_key():
                    try:
                        enroll_client(
                            self.config,
                            raw_password,
                            self.config.data.get("api_client_name")
                            or f"{APP_NAME} {PLATFORM}",
                        )
                    except Exception as e:
                        CustomDialog(
                            "Client enrollment failed\n" + str(e),
                            msg_type="error",
                        ).mainloop()
                        raw_password = None
                        continue
                elif raw_password:
                    self.config.data["password"] = (
                        CipherManager.string_to_sha3_512_lowercase_hex(raw_password)
                    )  # Hash the password
                elif not self.request_manager.has_api_key():
                    self.config.data["password"] = (
                        CipherManager.string_to_sha3_512_lowercase_hex(raw_password)
                    )

            login_successful, msg_login, self.config.data["cookie"] = (
                self.request_manager.login()
            )
            if login_successful:
                self.config.data["csrf_token"] = (
                    ""
                    if self.request_manager.has_api_key()
                    else self.request_manager.get_csrf_token()
                )
                self._configure_server_connection()
                ws_conn_successful, msg = self._get_ws_manager().connect()
                if ws_conn_successful:
                    self._get_ws_manager().is_login_phase = False
                    if self.config.data["cipher_enabled"]:
                        self._configure_encryption_key(raw_password)
                    if not self.config.data["save_password"]:
                        self.config.data["password"] = ""
                    if display_login_success_dialog:
                        CustomDialog(
                            "Success! ClipCascade will now run in the task bar/menu bar.",
                            msg_type="success",
                            timeout=5000,
                        ).mainloop()
                    break
                else:
                    CustomDialog(
                        "Login successful but websocket connection failed. \nPlease check websocket-url\n"
                        + msg,
                        msg_type="error",
                    ).mainloop()
            else:
                if self.request_manager.has_api_key() and msg_login.startswith(
                    "API key rejected:"
                ):
                    self._clear_rejected_api_auth(msg_login)
                CustomDialog("Login Failed\n" + msg_login, msg_type="error").mainloop()

            raw_password = None  # Clear the raw password
            if PLATFORM.startswith(LINUX) and LINUX_USE_CLI_UI:
                Echo("-" * 53)

    def _configure_server_connection(self):
        self.config.data["server_mode"] = self.request_manager.get_server_mode()
        if self.config.data["server_mode"] == "P2P":
            self.config.data["stun_url"] = self.request_manager.get_stun_url()
            self.config.data["maxsize"] = -1
            self.config.data["websocket_url"] = Config.convert_to_websocket_url(
                self.config.data["server_url"], WEBSOCKET_ENDPOINT_P2P
            )
        else:
            self.config.data["stun_url"] = ""
            self.config.data["websocket_url"] = Config.convert_to_websocket_url(
                self.config.data["server_url"], WEBSOCKET_ENDPOINT
            )
        self.config.data["maxsize"] = self.request_manager.maxsize()

    def _clear_rejected_api_auth(self, reason: str):
        if clear_rejected_api_auth(self.config.data):
            logging.warning(f"Cleared rejected API authentication: {reason}")
            self.config.save()

    def _get_ws_manager(self):
        if self.config.data["server_mode"] == "P2P":
            return self.p2p_manager
        else:
            return self.stomp_manager

    def _configure_encryption_key(self, raw_password: str = None):
        if not self.config.data.get("cipher_enabled"):
            self.config.data["hashed_password"] = None
            return

        sync_encryption_key = (self.config.data.get("sync_encryption_key") or "").strip()
        if sync_encryption_key:
            self.config.data["hashed_password"] = CipherManager.sync_encryption_key_to_bytes(
                sync_encryption_key
            )
            return

        if raw_password is not None:
            self.config.data["hashed_password"] = self.cipher_manager.hash_password(
                raw_password
            )
            return

        if not self.config.data.get("hashed_password"):
            raise ValueError(
                "Encryption is enabled, but no password-derived key or sync encryption key is configured."
            )

    def get_version_update_status(self) -> list:
        """
        Checks for a new version of the application by comparing the current version
        with the one available in a remote JSON file.

        Returns:
        list: [bool, str, str, str] - [Is new version available, latest version, current version, release URL]
        """
        try:
            response = RequestManager.get(VERSION_URL)
            response_data = response.json()
            if PLATFORM == WINDOWS:
                key = "windows"
            elif PLATFORM == MACOS:
                key = "macos"
            elif PLATFORM.startswith(LINUX):
                if not LINUX_USE_CLI_UI:
                    key = "linux_gui"
                else:
                    key = "linux_non_gui"

            if is_version_greater(response_data[key], APP_VERSION):
                return [True, response_data[key], APP_VERSION, RELEASE_URL]
        except Exception as e:
            logging.error(f"Error checking for new version: {e}")
        return [False, "", APP_VERSION, RELEASE_URL]

    def get_donation_url(self) -> str:
        try:
            metadata = self.request_manager.get_metadata()
            if metadata is not None:
                return metadata.get("funding", None)
        except Exception as e:
            logging.error(f"Error fetching metadata: {e}")
        return None

    def logoff_and_exit(self):
        try:
            self._get_ws_manager().disconnect()
            self.request_manager.logout()
            self.config.data["hashed_password"] = None
            self.config.data["cookie"] = None
            self.config.data["api_key"] = ""
            self.config.data["api_client_id"] = ""
            self.config.data["api_client_name"] = ""
            self.config.data["sync_encryption_key"] = ""
            self.config.data["maxsize"] = None
            self.config.data["password"] = ""
            self.config.data["csrf_token"] = ""
            self.config.save()
        except Exception as e:
            raise Exception(f"Error during logging off: {e}")

    def banner(self):
        if PLATFORM.startswith(LINUX) and LINUX_USE_CLI_UI:
            Echo(pyfiglet.figlet_format(APP_NAME))
            Echo("*" * 53)
            Echo("Real-Time Clipboard Syncing".center(53))
            Echo(GITHUB_URL.center(53))
            Echo("*" * 53)

    def run(self):
        try:
            self.banner()
            self.setup_logging()
            self.ensure_single_instance()
            self.config.load()
            if Config.normalize_websocket_url(self.config.data):
                logging.info("Normalized persisted websocket URL")
            self.authenticate_and_connect()
            self.config.save()
            update_available = self.get_version_update_status()
            donation_url = self.get_donation_url()

            sys_tray = TaskbarPanel(
                on_connect_callback=self._get_ws_manager().manual_reconnect,
                on_disconnect_callback=self._get_ws_manager().disconnect,
                on_logoff_callback=self.logoff_and_exit,
                new_version_available=update_available,
                github_url=GITHUB_URL,
                donation_url=donation_url,
                ws_interface=self._get_ws_manager(),
                config=self.config,
                activity_log=self.activity_log,
            )
            self._get_ws_manager().set_tray_ref(sys_tray)
            sys_tray.run()
        except Exception as e:
            msg = f"An unexpected error has occurred: {e}"
            logging.error(msg)
            CustomDialog(
                msg + "\nCheck logs in project directory", msg_type="error"
            ).mainloop()
        finally:
            self._get_ws_manager().disconnect()
            if PLATFORM == MACOS or PLATFORM.startswith(LINUX):
                if self.lock_file is not None:
                    fcntl.flock(self.lock_file, fcntl.LOCK_UN)
                    self.lock_file.close()
                    os.remove(self.mutex_identifier)
