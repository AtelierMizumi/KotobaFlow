import json
import sqlite3
import hashlib
import logging
from pathlib import Path
from typing import Optional, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class JobCacheDB:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    url_hash TEXT,
                    url TEXT,
                    status TEXT,
                    audio_path TEXT,
                    metadata TEXT,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_url_hash ON jobs(url_hash)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON jobs(created_at DESC)")

    def _hash_url(self, url: str) -> str:
        return hashlib.sha256(url.encode()).hexdigest()

    def save_job(self, job_id: str, url: str, status: str, metadata: dict = None):
        url_hash = self._hash_url(url)
        meta_str = json.dumps(metadata) if metadata else None
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO jobs (job_id, url_hash, url, status, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (job_id, url_hash, url, status, meta_str))

    def update_status(self, job_id: str, status: str, error: str = None, audio_path: str = None, metadata: dict = None):
        updates = ["status = ?"]
        params = [status]
        
        if error is not None:
            updates.append("error = ?")
            params.append(error)
        if audio_path is not None:
            updates.append("audio_path = ?")
            params.append(audio_path)
        if metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(metadata))
            
        params.append(job_id)
        
        query = f"UPDATE jobs SET {', '.join(updates)} WHERE job_id = ?"
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(query, tuple(params))

    def get_by_id(self, job_id: str) -> Optional[dict]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def get_by_url_hash(self, url: str) -> Optional[dict]:
        url_hash = self._hash_url(url)
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT * FROM jobs 
                WHERE url_hash = ? AND status = 'ready' 
                ORDER BY created_at DESC LIMIT 1
            """, (url_hash,))
            row = cursor.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def list_jobs(self, status: str = None, search: str = None, limit: int = 20, offset: int = 0) -> List[dict]:
        query = "SELECT * FROM jobs WHERE 1=1"
        params = []
        
        if status:
            query += " AND status = ?"
            params.append(status)
        if search:
            query += " AND (url LIKE ? OR metadata LIKE ?)"
            params.append(f"%{search}%")
            params.append(f"%{search}%")
            
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, tuple(params))
            return [self._row_to_dict(row) for row in cursor.fetchall()]

    def count_jobs(self, status: str = None) -> int:
        query = "SELECT COUNT(*) FROM jobs WHERE 1=1"
        params = []
        if status:
            query += " AND status = ?"
            params.append(status)
            
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(query, tuple(params))
            return cursor.fetchone()[0]

    def delete_job(self, job_id: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM jobs WHERE job_id = ?", (job_id,))

    def cleanup_old(self, max_age_days: int = 30):
        cutoff = datetime.now() - timedelta(days=max_age_days)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM jobs WHERE created_at < ? AND status != 'ready'", (cutoff,))

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        d = dict(row)
        if d.get('metadata'):
            try:
                d['metadata'] = json.loads(d['metadata'])
            except json.JSONDecodeError:
                d['metadata'] = None
        return d
