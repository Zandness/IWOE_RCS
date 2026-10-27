"""Session authentication and backend roles for WMS."""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field

COOKIE = 'wms_session_v2'
ROLES = Literal['viewer', 'operator', 'admin']
ITERATIONS = 600_000

class Login(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)

class NewUser(Login):
    display_name: str = Field(min_length=1, max_length=100)
    role: ROLES = 'viewer'

class UserEdit(BaseModel):
    model_config = ConfigDict(extra='forbid')
    role: ROLES
    enabled: bool = Field(strict=True)
    password: str | None = Field(default=None, max_length=128)

class PasswordChange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ITERATIONS).hex()
    return f'pbkdf2_sha256${ITERATIONS}${salt}${digest}'

def verify_password(password, encoded):
    try:
        algorithm, rounds, salt, digest = encoded.split('$')
        if algorithm != 'pbkdf2_sha256':
            return False
        candidate = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, TypeError):
        return False

def no_store(response: Response):
    response.headers['Cache-Control'] = 'no-store'


class WmsAuth:
    def __init__(self, database_path):
        self.database_path = database_path
        self.router = APIRouter(prefix='/auth', tags=['WMS users'], dependencies=[Depends(no_store)])
        self.register_routes()

    def connect(self):
        connection = sqlite3.connect(self.database_path(), timeout=15)
        connection.row_factory = sqlite3.Row
        connection.executescript('''
          CREATE TABLE IF NOT EXISTS wms_users (
            id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
            role TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
            auth_version INTEGER NOT NULL DEFAULT 1, created_at REAL NOT NULL
          );
          CREATE TABLE IF NOT EXISTS wms_sessions (
            token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
            auth_version INTEGER NOT NULL, expires_at REAL NOT NULL
          );
          CREATE TABLE IF NOT EXISTS wms_login_limits (
            key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, started_at REAL NOT NULL
          );
          CREATE TABLE IF NOT EXISTS wms_access_events (
            id INTEGER PRIMARY KEY, user_id INTEGER, username TEXT,
            action TEXT NOT NULL, created_at REAL NOT NULL, details_json TEXT NOT NULL
          );
        ''')
        return connection

    @staticmethod
    def public_user(row):
        return {key: row[key] for key in ['id', 'username', 'display_name', 'role']} if row else None

    @staticmethod
    def csrf(request):
        if request.headers.get('X-WMS-Request') != '1':
            raise HTTPException(403, 'A same-application WMS request header is required.')

    def current_user(self, request):
        token = request.cookies.get(COOKIE)
        if not token:
            return None
        connection = self.connect()
        try:
            row = connection.execute('''SELECT u.* FROM wms_sessions s JOIN wms_users u ON u.id=s.user_id
              WHERE s.token_hash=? AND s.expires_at>? AND u.enabled=1 AND s.auth_version=u.auth_version''', (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
            return self.public_user(row)
        finally:
            connection.close()

    def require_user(self, request: Request):
        user = self.current_user(request)
        if not user:
            raise HTTPException(401, 'Sign in to use WMS storage.')
        return user

    def require_operator(self, request: Request):
        self.csrf(request)
        user = self.require_user(request)
        if user['role'] not in ['operator', 'admin']:
            raise HTTPException(403, 'Viewer accounts cannot save warehouse changes.')
        return user

    def require_admin(self, request):
        user = self.require_user(request)
        if user['role'] != 'admin':
            raise HTTPException(403, 'Administrator permission is required.')
        return user

    @staticmethod
    def recheck_admin(connection, actor):
        current = connection.execute('SELECT role,enabled FROM wms_users WHERE id=?', (actor['id'],)).fetchone()
        if not current or not current['enabled'] or current['role'] != 'admin':
            raise HTTPException(403, 'Administrator permission is no longer available.')

    @staticmethod
    def event(connection, user, action, details=None):
        connection.execute('INSERT INTO wms_access_events(user_id,username,action,created_at,details_json) VALUES(?,?,?,?,?)', (user['id'] if user else None, user['username'] if user else None, action, time.time(), json.dumps(details or {})))

    def session(self, connection, user, request, response):
        token = secrets.token_urlsafe(32)
        ttl = 8 * 60 * 60
        connection.execute('DELETE FROM wms_sessions WHERE expires_at<=?', (time.time(),))
        connection.execute('INSERT INTO wms_sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user['id'], user['auth_version'], time.time() + ttl))
        secure = os.getenv('WMS_COOKIE_SECURE', '').strip() == '1' or request.url.scheme == 'https'
        response.delete_cookie('wms_session', path='/api/wms', httponly=True, samesite='strict')
        response.delete_cookie('wms_session', path='/api', httponly=True, samesite='strict')
        response.set_cookie(COOKIE, token, httponly=True, secure=secure, samesite='strict', max_age=ttl, path='/api')

    @staticmethod
    def username(value):
        value = value.strip().lower()
        if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,63}', value):
            raise HTTPException(422, 'Username must have 3–64 letters, numbers, dots, underscores or hyphens.')
        return value

    @staticmethod
    def check_password(value):
        if not 12 <= len(value) <= 128 or not value.strip():
            raise HTTPException(422, 'Password must contain 12–128 characters.')

    def register_routes(self):
        router = self.router

        @router.get('/status')
        def status(request: Request, response: Response):
            response.headers['Cache-Control'] = 'no-store'
            connection = self.connect()
            try:
                needs_setup = connection.execute('SELECT COUNT(*) FROM wms_users').fetchone()[0] == 0
            finally:
                connection.close()
            return {'needs_setup': needs_setup, 'user': self.current_user(request)}

        @router.post('/setup')
        def setup(body: NewUser, request: Request, response: Response):
            self.csrf(request)
            username = self.username(body.username)
            self.check_password(body.password)
            name = body.display_name.strip()
            if not name:
                raise HTTPException(422, 'Display name is required.')
            encoded = password_hash(body.password)
            connection = self.connect()
            try:
                connection.execute('BEGIN IMMEDIATE')
                if connection.execute('SELECT COUNT(*) FROM wms_users').fetchone()[0]:
                    raise HTTPException(409, 'Initial administrator has already been created. Sign in instead.')
                connection.execute('INSERT INTO wms_users(username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?)', (username, name, encoded, 'admin', time.time()))
                user = connection.execute('SELECT * FROM wms_users WHERE username=?', (username,)).fetchone()
                self.event(connection, user, 'ADMIN_SETUP')
                self.session(connection, user, request, response)
                connection.commit()
                return {'user': self.public_user(user)}
            finally:
                connection.close()

        @router.post('/login')
        def login(body: Login, request: Request, response: Response):
            self.csrf(request)
            username = body.username.strip().lower()
            key = f'{request.client.host if request.client else "unknown"}/{username}'
            connection = self.connect()
            try:
                connection.execute('BEGIN IMMEDIATE')
                limit = connection.execute('SELECT * FROM wms_login_limits WHERE key=?', (key,)).fetchone()
                now = time.time()
                attempts = limit['attempts'] if limit and now - limit['started_at'] < 600 else 0
                started = limit['started_at'] if attempts else now
                if attempts >= 5:
                    raise HTTPException(429, 'Too many sign-in attempts. Try again in 10 minutes.')
                connection.execute('INSERT INTO wms_login_limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,started_at=excluded.started_at', (key, attempts + 1, started))
                connection.commit()
                user = connection.execute('SELECT * FROM wms_users WHERE username=?', (username,)).fetchone()
                encoded = user['password_hash'] if user else f'pbkdf2_sha256${ITERATIONS}$dummy$' + '0' * 64
                valid = verify_password(body.password, encoded)
                if not valid or not user or not user['enabled']:
                    raise HTTPException(401, 'Invalid username or password.')
                connection.execute('DELETE FROM wms_login_limits WHERE key=?', (key,))
                self.session(connection, user, request, response)
                self.event(connection, user, 'LOGIN')
                connection.commit()
                return {'user': self.public_user(user)}
            finally:
                connection.close()

        @router.post('/authorize')
        def authorize(request: Request):
            user = self.require_operator(request)
            return {'user': user, 'authorized_at': time.time()}

        @router.post('/logout')
        def logout(request: Request, response: Response):
            self.csrf(request)
            token = request.cookies.get(COOKIE)
            connection = self.connect()
            try:
                user = self.current_user(request)
                if token:
                    connection.execute('DELETE FROM wms_sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
                self.event(connection, user, 'LOGOUT')
                connection.commit()
            finally:
                connection.close()
            response.delete_cookie(COOKIE, path='/api/wms', httponly=True, samesite='strict')
            response.delete_cookie(COOKIE, path='/api', httponly=True, samesite='strict')
            response.delete_cookie('wms_session', path='/api/wms', httponly=True, samesite='strict')
            response.delete_cookie('wms_session', path='/api', httponly=True, samesite='strict')
            return {'ok': True}

        @router.get('/users')
        def users(request: Request):
            self.require_admin(request)
            connection = self.connect()
            try:
                return {'users': [dict(row) for row in connection.execute('SELECT id,username,display_name,role,enabled FROM wms_users ORDER BY username')]}
            finally:
                connection.close()

        @router.post('/users')
        def add_user(body: NewUser, request: Request):
            self.csrf(request)
            actor = self.require_admin(request)
            username = self.username(body.username)
            self.check_password(body.password)
            if not body.display_name.strip():
                raise HTTPException(422, 'Display name is required.')
            encoded = password_hash(body.password)
            connection = self.connect()
            try:
                connection.execute('BEGIN IMMEDIATE')
                self.recheck_admin(connection, actor)
                try:
                    connection.execute('INSERT INTO wms_users(username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?)', (username, body.display_name.strip(), encoded, body.role, time.time()))
                except sqlite3.IntegrityError as error:
                    raise HTTPException(409, 'Username already exists.') from error
                self.event(connection, actor, 'USER_CREATED', {'username': username, 'role': body.role})
                connection.commit()
                return {'ok': True}
            finally:
                connection.close()

        @router.patch('/users/{user_id}')
        def edit_user(user_id: int, body: UserEdit, request: Request):
            self.csrf(request)
            actor = self.require_admin(request)
            encoded = None
            if body.password is not None:
                self.check_password(body.password)
                encoded = password_hash(body.password)
            connection = self.connect()
            try:
                connection.execute('BEGIN IMMEDIATE')
                self.recheck_admin(connection, actor)
                target = connection.execute('SELECT * FROM wms_users WHERE id=?', (user_id,)).fetchone()
                if not target:
                    raise HTTPException(404, 'User not found.')
                admins = connection.execute("SELECT COUNT(*) FROM wms_users WHERE role='admin' AND enabled=1").fetchone()[0]
                if target['role'] == 'admin' and target['enabled'] and (body.role != 'admin' or not body.enabled) and admins <= 1:
                    raise HTTPException(409, 'The last enabled administrator cannot be disabled or demoted.')
                connection.execute('UPDATE wms_users SET role=?,enabled=?,password_hash=?,auth_version=auth_version+1 WHERE id=?', (body.role, int(body.enabled), encoded or target['password_hash'], user_id))
                connection.execute('DELETE FROM wms_sessions WHERE user_id=?', (user_id,))
                self.event(connection, actor, 'USER_UPDATED', {'user_id': user_id, 'role': body.role, 'enabled': body.enabled, 'password_reset': encoded is not None})
                connection.commit()
                return {'ok': True}
            finally:
                connection.close()

        @router.post('/password')
        def change_password(body: PasswordChange, request: Request, response: Response):
            self.csrf(request)
            actor = self.require_user(request)
            self.check_password(body.new_password)
            connection = self.connect()
            try:
                connection.execute('BEGIN IMMEDIATE')
                user = connection.execute('SELECT * FROM wms_users WHERE id=?', (actor['id'],)).fetchone()
                if not verify_password(body.current_password, user['password_hash']):
                    raise HTTPException(401, 'Current password is incorrect.')
                connection.execute('UPDATE wms_users SET password_hash=?,auth_version=auth_version+1 WHERE id=?', (password_hash(body.new_password), actor['id']))
                connection.execute('DELETE FROM wms_sessions WHERE user_id=?', (actor['id'],))
                updated = connection.execute('SELECT * FROM wms_users WHERE id=?', (actor['id'],)).fetchone()
                self.session(connection, updated, request, response)
                self.event(connection, actor, 'PASSWORD_CHANGED')
                connection.commit()
                return {'user': self.public_user(updated)}
            finally:
                connection.close()
