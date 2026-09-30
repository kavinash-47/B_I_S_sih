"""Run once: python scripts/init_db.py
Creates bis_auditor.db with all tables. Safe to re-run (CREATE TABLE IF NOT EXISTS).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import init_db

if __name__ == "__main__":
    init_db()
    print("Database initialised.")
