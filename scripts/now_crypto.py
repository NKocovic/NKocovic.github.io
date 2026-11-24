"""Encryption shared by the /now/ scripts. now/index.html does the same with WebCrypto."""
import base64, json, os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 600_000


def _key(password, salt, iterations):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations).derive(password.encode())


def encrypt(obj, password, extra=None):
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(_key(password, salt, ITERATIONS)).encrypt(iv, json.dumps(obj).encode(), None)
    b64 = lambda b: base64.b64encode(b).decode()
    return {**(extra or {}), "iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}


def decrypt(file, password):
    d = lambda k: base64.b64decode(file[k])
    return json.loads(AESGCM(_key(password, d("salt"), file["iter"])).decrypt(d("iv"), d("ct"), None))
