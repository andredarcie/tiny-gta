#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mixamo_cli — baixa animacoes do Mixamo em lote pela API interna (nao-oficial).

Baseado na engenharia reversa de:
  - https://github.com/gnuton/mixamo_anims_downloader
  - https://gist.github.com/gnuton/ec2c3c2097f7aeaea8bb7d1256e4b212

AVISO: API nao-oficial/nao-documentada. Pode quebrar a qualquer momento e e zona
cinzenta de ToS. Use com sua propria conta, para uso pessoal.

Pre-requisitos (uma vez):
  1. Faca login em https://www.mixamo.com
  2. Suba e rigge seu personagem (Upload Character -> Auto-Rigger).
  3. Pegue o ACCESS TOKEN: F12 > Console > digite:  localStorage.access_token
  4. Pegue o CHARACTER ID: baixe 1 animacao, na aba Network procure a chamada
     'export' / 'monitor'; o id do personagem aparece na URL .../characters/<ID>/...
     (Opcional: deixe vazio e o script auto-detecta o personagem primario.)
  5. Cole os dois em mixamo_config.json (ou use as env MIXAMO_TOKEN / MIXAMO_CHARACTER).

Exemplos:
  python mixamo_cli.py --search "walk"                 # lista animacoes que casam
  python mixamo_cli.py --get "Walking" --skin          # baixa "Walking" COM skin (personagem-base)
  python mixamo_cli.py --get "Idle,Running,Jump"       # baixa varias SEM skin
  python mixamo_cli.py --query "pistol" --max 10       # baixa ate 10 resultados de "pistol"
  python mixamo_cli.py --out ./fbx --fps 30 --get "Walking"
"""
import argparse, json, os, re, sys, time
import requests

API = "https://www.mixamo.com/api/v1"
HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "mixamo_config.json")


def die(msg, code=1):
    print("ERRO:", msg, file=sys.stderr)
    sys.exit(code)


def load_cfg():
    token = os.environ.get("MIXAMO_TOKEN")
    char = os.environ.get("MIXAMO_CHARACTER")
    if os.path.exists(CONFIG):
        try:
            d = json.load(open(CONFIG, encoding="utf-8"))
        except Exception as e:
            die(f"mixamo_config.json invalido: {e}")
        token = token or d.get("access_token")
        char = char or d.get("character_id")
    if not token:
        die("sem access_token. Preencha mixamo_config.json ou env MIXAMO_TOKEN. Veja o cabecalho do script.")
    return token, char


def headers(token):
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Api-Key": "mixamo2",
    }


def _check(r):
    if r.status_code == 401:
        die("401 nao autorizado — token expirou. Pegue um novo (localStorage.access_token) e atualize o config.")
    r.raise_for_status()
    return r


def search(token, query, max_pages=3):
    out = []
    for page in range(1, max_pages + 1):
        r = _check(requests.get(
            f"{API}/products",
            params={"page": page, "limit": 96, "order": "",
                    "type": "Motion", "query": query or ""},
            headers=headers(token), timeout=30))
        data = r.json()
        out += data.get("results", [])
        pag = data.get("pagination", {})
        if page >= pag.get("num_pages", 1):
            break
    return out


def get_primary(token):
    """Pega o character_id do personagem PRIMARIO (o ultimo que voce riggou)."""
    r = _check(requests.get(f"{API}/characters/primary", headers=headers(token), timeout=30))
    j = r.json()
    return j.get("primary_character_id"), j.get("primary_character_name")


def find_anim(token, name, pages):
    """Acha 1 animacao por nome: casa EXATO; senao o nome mais curto que contem o termo."""
    def nm(a): return (a.get("description") or a.get("name") or "")
    cands = [a for a in search(token, name, pages) if a.get("type") == "Motion"]
    low = name.strip().lower()
    exact = [a for a in cands if nm(a).lower() == low]
    if exact:
        return exact[0]
    contains = sorted([a for a in cands if low in nm(a).lower()], key=lambda a: len(nm(a)))
    return contains[0] if contains else None


def get_details(token, anim_id, char):
    r = _check(requests.get(
        f"{API}/products/{anim_id}",
        params={"similar": 0, "character_id": char},
        headers=headers(token), timeout=30))
    return r.json()


def export(token, anim_id, char, skin, fps):
    d = get_details(token, anim_id, char)
    det = d["details"]
    if "gms_hash" not in det:
        raise ValueError("sem gms_hash (provavelmente um MotionPack) — pulado")
    gms = det["gms_hash"]
    # params vem como lista [[nome, default, ...], ...] -> string de defaults separada por virgula
    if isinstance(gms.get("params"), list):
        gms["params"] = ",".join(str(p[1]) for p in gms["params"])
    body = {
        "character_id": char,
        "gms_hash": [gms],
        "preferences": {"format": "fbx7", "skin": "true" if skin else "false",
                        "fps": str(fps), "reducekf": "0"},
        "product_name": d.get("description") or det.get("name") or str(anim_id),
        "type": "Motion",
    }
    _check(requests.post(f"{API}/animations/export",
                         data=json.dumps(body), headers=headers(token), timeout=30))
    return body["product_name"]


def monitor(token, char, timeout_s=120):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        r = _check(requests.get(f"{API}/characters/{char}/monitor",
                                headers=headers(token), timeout=30))
        m = r.json()
        st = m.get("status")
        if st == "completed":
            return m["job_result"]
        if st == "failed":
            raise RuntimeError(f"export falhou: {m}")
        time.sleep(1)
    raise TimeoutError("monitor: tempo esgotado")


def safe(name):
    return re.sub(r"[^\w\-]+", "_", name).strip("_") or "anim"


def download(url, path):
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    with open(path, "wb") as f:
        f.write(r.content)
    return len(r.content)


def fetch_one(token, char, anim, skin, fps, outdir):
    name = anim.get("description") or anim.get("name") or str(anim["id"])
    print(f"  -> exportando: {name}  (skin={'sim' if skin else 'nao'})")
    export(token, anim["id"], char, skin, fps)
    url = monitor(token, char)
    out = os.path.join(outdir, safe(name) + ".fbx")
    n = download(url, out)
    print(f"     OK  {out}  ({n/1024:.0f} KB)")


def main():
    ap = argparse.ArgumentParser(description="CLI nao-oficial do Mixamo")
    ap.add_argument("--search", metavar="Q", help="apenas LISTA animacoes que casam com Q")
    ap.add_argument("--get", metavar="NOMES", help="baixa por nome exato (separados por virgula)")
    ap.add_argument("--query", metavar="Q", help="baixa varios resultados da busca Q (use com --max)")
    ap.add_argument("--max", type=int, default=20, help="limite de downloads no modo --query (def 20)")
    ap.add_argument("--skin", action="store_true", help="exporta COM skin (use no personagem-base)")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--out", default=os.path.join(HERE, "fbx"), help="pasta de saida")
    ap.add_argument("--pages", type=int, default=3, help="paginas de busca a varrer")
    args = ap.parse_args()

    token, char = load_cfg()

    # modo busca
    if args.search is not None:
        res = search(token, args.search, args.pages)
        print(f"{len(res)} resultado(s) para '{args.search}':")
        for a in res:
            print(f"  [{a.get('type','?'):10}] {a.get('description') or a.get('name')}")
        return

    if not char:
        # auto-detecta o personagem primario (o ultimo riggado), sem precisar da aba Network
        char, cname = get_primary(token)
        if not char:
            die("sem character_id e nenhum personagem primario encontrado. Rigge um personagem no Mixamo.")
        print(f"Personagem primario: {cname}  ({char})")
    os.makedirs(args.out, exist_ok=True)

    # modo --get (nomes exatos)
    if args.get:
        wanted = [w.strip() for w in args.get.split(",") if w.strip()]
        for w in wanted:
            a = find_anim(token, w, args.pages)
            if not a:
                print(f"  (nao achei) {w}"); continue
            try:
                fetch_one(token, char, a, args.skin, args.fps, args.out)
            except Exception as e:
                print("     FALHOU:", e)
        return

    # modo --query (lote por busca)
    if args.query:
        res = search(token, args.query, args.pages)[: args.max]
        print(f"baixando {len(res)} animacao(oes) de '{args.query}' -> {args.out}")
        for i, a in enumerate(res, 1):
            print(f"[{i}/{len(res)}]")
            try:
                fetch_one(token, char, a, args.skin, args.fps, args.out)
            except Exception as e:
                print("     FALHOU:", e)
        return

    ap.print_help()


if __name__ == "__main__":
    main()
