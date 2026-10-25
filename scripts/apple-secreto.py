#!/usr/bin/env python3
"""Fabrica la «clave secreta» (client secret) de Sign in with Apple para la WEB. Caduca como máximo a los 6 meses, por eso este programa se corre cada 3.

Uso:  python3 scripts/apple-secreto.py RUTA_AL_ARCHIVO.p8 KEY_ID TEAM_ID SERVICES_ID
Imprime el JWT (ES256) en una sola línea. NUNCA se guarda el .p8 en el repositorio.
"""
import base64, json, sys, time
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

def b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b'=').decode()

def fabrica(ruta_p8: str, key_id: str, team_id: str, services_id: str, dias: int = 170) -> str:
    llave = serialization.load_pem_private_key(open(ruta_p8, 'rb').read(), password=None)
    ahora = int(time.time())
    cabecera = {'alg': 'ES256', 'kid': key_id, 'typ': 'JWT'}
    cuerpo = {'iss': team_id, 'iat': ahora, 'exp': ahora + dias * 86400, 'aud': 'https://appleid.apple.com', 'sub': services_id}
    firmando = f"{b64(json.dumps(cabecera, separators=(',', ':')).encode())}.{b64(json.dumps(cuerpo, separators=(',', ':')).encode())}"
    r, s = decode_dss_signature(llave.sign(firmando.encode(), ec.ECDSA(hashes.SHA256())))
    return f"{firmando}.{b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}"

if __name__ == '__main__':
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    print(fabrica(*sys.argv[1:5]))
