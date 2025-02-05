# app/task/__init__.py
from flask import Blueprint, jsonify
import logging
from ..db import get_db
from .tasks import TaskScheduler

bp = Blueprint('tasks', __name__)
logger = logging.getLogger(__name__)


@bp.route('', methods=['GET'])
def get_all_tasks():
    try:
        with get_db() as conn:
            tasks = conn.execute('SELECT * FROM scheduled_tasks').fetchall()
            result = []

            scheduler_instance = TaskScheduler.get_instance()
            if scheduler_instance:
                for task in tasks:
                    # Get the job from scheduler
                    job = scheduler_instance.scheduler.get_job(str(task['id']))
                    next_run = job.next_run_time if job else None

                    result.append({
                        'id':
                        task['id'],
                        'name':
                        task['name'],
                        'type':
                        task['type'],
                        'interval_minutes':
                        task['interval_minutes'],
                        'last_run':
                        task['last_run'],
                        'next_run':
                        next_run.isoformat() if next_run else None,
                        'status':
                        task['status']
                    })

            return jsonify(result), 200

    except Exception as e:
        logger.exception("Unexpected error occurred")
        return jsonify({"error": "An unexpected error occurred"}), 500


@bp.route('/<int:task_id>', methods=['GET'])
def get_task(task_id):
    try:
        with get_db() as conn:
            task = conn.execute('SELECT * FROM scheduled_tasks WHERE id = ?',
                                (task_id, )).fetchone()

            if not task:
                return jsonify({"error": "Task not found"}), 404

            scheduler_instance = TaskScheduler.get_instance()
            if scheduler_instance:
                job = scheduler_instance.scheduler.get_job(str(task['id']))
                next_run = job.next_run_time if job else None
            else:
                next_run = None

            return jsonify({
                'id': task['id'],
                'name': task['name'],
                'type': task['type'],
                'interval_minutes': task['interval_minutes'],
                'last_run': task['last_run'],
                'next_run': next_run.isoformat() if next_run else None,
                'status': task['status']
            }), 200

    except Exception as e:
        logger.exception("Unexpected error occurred")
        return jsonify({"error": "An unexpected error occurred"}), 500


@bp.route('/<int:task_id>/run', methods=['POST'])
def trigger_task(task_id):
    try:
        with get_db() as conn:
            task = conn.execute('SELECT * FROM scheduled_tasks WHERE id = ?',
                                (task_id, )).fetchone()

            if not task:
                return jsonify({"error": "Task not found"}), 404

            # Get the task class and run it
            task_class = TaskScheduler.get_task_class(task['type'])
            if not task_class:
                return jsonify({"error": "Invalid task type"}), 400

            task_instance = task_class(
                id=task['id'],
                name=task['name'],
                interval_minutes=task['interval_minutes'])

            try:
                task_instance.update_status('running')
                task_instance.run_job()
                task_instance.update_status('success')
                return jsonify(
                    {"message": f"Task {task_id} triggered successfully"}), 200
            except Exception as e:
                task_instance.update_status('failed')
                logger.error(f"Task {task_id} failed: {str(e)}")
                return jsonify({"error": f"Task failed: {str(e)}"}), 500

    except Exception as e:
        logger.exception("Unexpected error occurred")
        return jsonify({"error": "An unexpected error occurred"}), 500


__all__ = ['bp', 'TaskScheduler']
