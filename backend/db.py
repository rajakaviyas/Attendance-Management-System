from contextlib import contextmanager

import mysql.connector
from mysql.connector import pooling

from config import Config


pool = None


def get_pool():
    global pool
    if pool is None:
        pool = pooling.MySQLConnectionPool(
            pool_name="attendance_pool",
            pool_size=5,
            host=Config.MYSQL_HOST,
            port=Config.MYSQL_PORT,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            database=Config.MYSQL_DATABASE,
        )
    return pool


@contextmanager
def get_connection():
    connection = get_pool().get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def fetch_all(query, params=None):
    with get_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        rows = cursor.fetchall()
        cursor.close()
        return rows


def fetch_one(query, params=None):
    with get_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        row = cursor.fetchone()
        cursor.close()
        return row


def execute(query, params=None):
    with get_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        last_id = cursor.lastrowid
        rowcount = cursor.rowcount
        cursor.close()
        return last_id, rowcount
