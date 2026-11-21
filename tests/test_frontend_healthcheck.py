"""Healthcheck container frontend (Docker/Coolify): /healthz di Nginx, HEALTHCHECK di Dockerfile, dan skrip start yang
memecah BACKEND_UPSTREAM agar Nginx tetap hidup walau backend belum bisa di-resolve."""
import os
import re
import shutil
import subprocess

import pytest

ROOT = os.path.join(os.path.dirname(__file__), '..')
FE = os.path.join(ROOT, 'frontend')


def _baca(*bagian):
    with open(os.path.join(ROOT, *bagian), encoding='utf-8') as f:
        return f.read()


@pytest.mark.parametrize('conf', ['nginx.conf', 'nginx-traefik.conf'])
def test_nginx_punya_healthz_tanpa_log(conf):
    isi = _baca('frontend', conf)
    blok = isi[isi.index('location = /healthz'):]
    blok = blok[:blok.index('\n    }\n')]
    assert 'access_log off;' in blok and 'return 200' in blok and 'return 503' in blok


@pytest.mark.parametrize('dockerfile', ['Dockerfile', 'Dockerfile.traefik'])
def test_dockerfile_healthcheck_ke_127001(dockerfile):
    isi = _baca('frontend', dockerfile)
    assert re.search(r'HEALTHCHECK .*\n\s+CMD wget -q -O /dev/null http://127\.0\.0\.1/healthz', isi)
    assert 'docker/30-superapp-listen-ipv6.sh' in isi


def test_proxy_api_memakai_resolver_dan_variabel():
    isi = _baca('frontend', 'nginx.conf')
    assert 'proxy_pass ${BACKEND_UPSTREAM}' not in isi  # nginx mati bila host belum bisa di-resolve saat start
    for s in ('resolver ${NGINX_LOCAL_RESOLVERS}', 'set $backend_origin "${BACKEND_ORIGIN}";',
              'rewrite ^/api/(.*)$ ${BACKEND_PATH}$1 break;', 'proxy_pass $backend_origin;'):
        assert s in isi, s
    assert 'docker/15-superapp-upstream.envsh' in _baca('frontend', 'Dockerfile')


def test_compose_healthcheck_dan_upstream():
    isi = _baca('docker-compose.yml')
    fe = isi[isi.index('\n  frontend:'):]
    assert 'http://127.0.0.1/healthz' in fe and 'BACKEND_UPSTREAM: ${BACKEND_UPSTREAM:-http://backend:8000/api/}' in fe
    assert 'http://127.0.0.1/healthz' in _baca('docker-compose.traefik.yml')


@pytest.mark.skipif(not shutil.which('sh') or not shutil.which('awk'), reason='butuh sh & awk')
@pytest.mark.parametrize('upstream, origin, path', [
    ('http://backend:8000/api/', 'http://backend:8000', '/api/'),
    ('https://api.contoh.sch.id/api/', 'https://api.contoh.sch.id', '/api/'),
    ('http://backend:8000', 'http://backend:8000', '/api/'),
    ('http://backend:8000/v1/', 'http://backend:8000', '/v1/'),
    ('backend:8000', 'http://127.0.0.1:65535', '/api/'),
    ('', 'http://127.0.0.1:65535', '/api/'),
])
def test_skrip_upstream_memecah_backend_upstream(upstream, origin, path):
    skrip = os.path.join(FE, 'docker', '15-superapp-upstream.envsh')
    env = {'PATH': os.environ.get('PATH', ''), 'BACKEND_UPSTREAM': upstream, 'NGINX_LOCAL_RESOLVERS': '127.0.0.11'}
    out = subprocess.run(['sh', '-c', f'. "{skrip}" >/dev/null 2>&1; printf "%s|%s|%s" "$BACKEND_ORIGIN" "$BACKEND_PATH" "$NGINX_LOCAL_RESOLVERS"'],
                         env=env, capture_output=True, text=True, check=True).stdout
    assert out == f'{origin}|{path}|127.0.0.11'
