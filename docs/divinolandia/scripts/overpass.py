"""Run an Overpass QL query and save the JSON result.
Usage: python -I overpass.py <query-file> <out.json>"""
import sys, urllib.request, urllib.parse, json, time
q = open(sys.argv[1], encoding='utf8').read()
for url in ('https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
    try:
        req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(),
                                     headers={'User-Agent': 'tiny-gta-divinolandia-research/1.0'})
        raw = urllib.request.urlopen(req, timeout=180).read()
        d = json.loads(raw)
        json.dump(d, open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False)
        print(sys.argv[2], len(d.get('elements', [])), 'elements')
        break
    except Exception as e:
        print('fail', url, e); time.sleep(3)
