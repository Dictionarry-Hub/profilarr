import sys
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import subprocess
import os


class Reloader(FileSystemEventHandler):

    def __init__(self):
        self.process = None
        self.last_restart = 0
        self.start_app()

    def on_any_event(self, event):
        if event.src_path.endswith(
                '.py') and not event.src_path.endswith('run_dev.py'):
            current_time = time.time()
            if current_time - self.last_restart > 1:  # Prevent rapid restarts
                print(f"Detected change in {event.src_path}, restarting...")
                self.restart_app()
                self.last_restart = current_time

    def start_app(self):
        env = os.environ.copy()
        env['FLASK_ENV'] = 'development'
        self.process = subprocess.Popen([sys.executable, 'run.py'], env=env)

    def restart_app(self):
        if self.process:
            self.process.terminate()
            self.process.wait()
        self.start_app()


if __name__ == "__main__":
    path = '.'
    event_handler = Reloader()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
