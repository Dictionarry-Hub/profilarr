# app/task/tasks.py
from abc import ABC, abstractmethod
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import logging
import re

from ..db import get_db

task_logger = logging.getLogger('task_system')
task_logger.setLevel(logging.DEBUG)


class Task(ABC):

    def __init__(self, id=None, name=None, interval_minutes=None):
        self.id = id
        self.name = name
        self.interval_minutes = interval_minutes
        self.last_run = None
        self.status = 'pending'

    @abstractmethod
    def run_job(self):
        pass

    def update_status(self, status):
        task_logger.info(
            f"Task {self.name} (ID: {self.id}) status changed to: {status}")
        with get_db() as conn:
            conn.execute(
                '''
                UPDATE scheduled_tasks
                SET status = ?, last_run = ?
                WHERE id = ?
                ''', (status, datetime.now(), self.id))
            conn.commit()


class TaskScheduler:
    _instance = None

    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.logger = logging.getLogger('TaskScheduler')
        TaskScheduler._instance = self

    @classmethod
    def get_instance(cls):
        return cls._instance

    def load_tasks_from_db(self):
        with get_db() as conn:
            tasks = conn.execute('SELECT * FROM scheduled_tasks').fetchall()
            for task_data in tasks:
                task_class = self.get_task_class(task_data['type'])
                if task_class:
                    task = task_class(
                        id=task_data['id'],
                        name=task_data['name'],
                        interval_minutes=task_data['interval_minutes'])
                    self.schedule_task(task)

    def schedule_task(self, task):
        self.scheduler.add_job(self._run_task_wrapper(task),
                               'interval',
                               minutes=task.interval_minutes,
                               id=str(task.id))

    def _run_task_wrapper(self, task):

        def wrapped():
            task_logger.info(f"Starting task: {task.name} (ID: {task.id})")
            start_time = datetime.now()
            try:
                task.update_status('running')
                task.run_job()
                end_time = datetime.now()
                duration = (end_time - start_time).total_seconds()
                task_logger.info(
                    f"Task {task.name} completed successfully in {duration:.2f} seconds"
                )
                task.update_status('success')
            except Exception as e:
                end_time = datetime.now()
                duration = (end_time - start_time).total_seconds()
                task_logger.error(
                    f"Task {task.name} failed after {duration:.2f} seconds: {str(e)}"
                )
                task.update_status('failed')

        return wrapped

    def start(self):
        self.scheduler.start()

    @staticmethod
    def get_task_class(task_type):
        task_classes = {
            'Sync': SyncTask,
            'Backup': BackupTask,
            'ImportSchedule': ImportScheduleTask,
        }
        return task_classes.get(task_type)


class SyncTask(Task):

    def run_job(self):
        """Updates remote git status and performs other sync operations"""
        from ..git.status.status import GitStatusManager
        import os
        from ..config.config import config

        repo_path = config.DB_DIR

        # Quick check if there's a valid git repo
        if not os.path.exists(os.path.join(repo_path, '.git')):
            task_logger.info("No valid git repository found - skipping sync")
            return

        # If we have a valid repo, proceed with sync
        status_manager = GitStatusManager.get_instance(repo_path)
        if status_manager:
            success = status_manager.update_remote_status()
            if not success:
                task_logger.error("Failed to update remote git status")


class BackupTask(Task):

    def run_job(self):
        """Performs configuration backup and cleanup"""
        from .backup.backup import BackupManager

        logger = logging.getLogger(__name__)
        logger.info(f"Running backup task {self.name}")

        manager = BackupManager()
        success, backup_name = manager.create_backup()

        if success:
            logger.info(f"Backup created successfully: {backup_name}")
            # Run cleanup to remove old backups
            manager.cleanup_old_backups()
        else:
            logger.error(f"Backup failed: {backup_name}"
                         )  # backup_name contains error message in this case


class ImportScheduleTask(Task):
    """
    A scheduled task that runs the "run_import_for_config" logic for a specific ARR config
    (inferred by parsing the config ID from the task's 'name').
    For example, if the scheduled_tasks.name is 'Import for ARR #1 - radarr',
    we parse '1' out of that string to know which arr_config to import.
    """

    def run_job(self):

        from ..arr.manager import get_arr_config, run_import_for_config

        # 1) Attempt to parse the config ID from the self.name
        match = re.search(r"#(\d+)", self.name)
        if not match:
            task_logger.error(
                f"[ImportScheduleTask] Could not parse config ID from task name '{self.name}'. Skipping."
            )
            return

        config_id = match.group(1)
        task_logger.info(
            f"[ImportScheduleTask] Found config_id={config_id} from task '{self.name}'"
        )

        # 2) Get the corresponding arr_config
        arr_config_response = get_arr_config(config_id)
        if not arr_config_response.get('success'):
            task_logger.error(
                f"[ImportScheduleTask] arr_config id={config_id} not found. Skipping."
            )
            return

        config_data = arr_config_response['data']

        # 3) Call run_import_for_config
        task_logger.info(
            f"[ImportScheduleTask] Running run_import_for_config for arr_config #{config_id}"
        )
        run_import_for_config(config_data)
        task_logger.info(
            f"[ImportScheduleTask] Done importing for arr_config #{config_id}")
