"""Puebla data/ciudades/<id>.json con población real del Censo 2022 (radios censales, INDEC /
Rodriguez & de Grande CONICET, CC-BY-4.0):
  1. Barrios OSM (tipo 'barrio'): se hacen disjuntos y reciben población por área de intersección con radios.
  2. Fracciones censales (tipo 'fraccion'): cubren el territorio NO ocupado por barrios OSM, con población real.
     Si la ciudad no tiene barrios OSM, queda solo con fracciones.
Es idempotente: vuelve a calcular las fracciones en cada corrida.
Uso: python -I scripts/build-poblacion-barrios.py <radios.parquet> [AR-X ...]"""
import collections, json, math, pathlib, re, sys
import pyarrow.parquet as pq
from shapely import wkb
from shapely.affinity import scale
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

W = 1000
KM = 111.2                      # km por grado de latitud
RURAL_AREA, RURAL_DENS = 0.06, 200   # descarta fracciones >6% del recuadro con <200 hab/km²
cfg = json.load(open('data/game.json', encoding='utf-8'))['capitales']
ids = sys.argv[2:] or sorted(cfg)

t = pq.read_table(sys.argv[1], columns=['PROV', 'DEPTO', 'FRACC', 'POB_TOT_P', 'geometry']).to_pydict()
print('radios:', len(t['PROV']), 'población total:', sum(p or 0 for p in t['POB_TOT_P']))
GEOM = [wkb.loads(g) for g in t['geometry']]
CENT = [g.centroid for g in GEOM]


def parts(g):
    return list(g.geoms) if hasattr(g, 'geoms') else [g]


for pid in ids:
    c = cfg[pid]
    hw = min(0.2, max(0.04, 0.04 + (c['pop'] / 1.5e6) * 0.16))
    cf = math.cos(math.radians(c['lat'])); k = W / (2 * hw * cf)
    w0, n0 = c['lon'] - hw, c['lat'] + hw
    H = 2 * hw * k
    to_m = lambda x, y: ((w0 + x / (cf * k)) * cf, n0 - y / k)     # svg -> metros locales (lon*cosφ, lat)
    to_svg = lambda X, Y: ((X - w0 * cf) * k, (n0 - Y) * k)         # metros locales -> svg
    bbox_km2 = (2 * hw * KM) ** 2 * cf

    f = pathlib.Path(f'data/ciudades/{pid}.json')
    city = json.load(open(f, encoding='utf-8')) if f.exists() else {'ciudad': c['ciudad'], 'viewBox': [0, 0, W, round(H, 1)], 'zonas': []}
    barrios = [z for z in city['zonas'] if z.get('tipo') != 'fraccion']

    # radios dentro del recuadro (CABA: solo su jurisdicción, para no arrastrar el conurbano)
    idx = [i for i, p in enumerate(CENT)
           if abs(p.x - c['lon']) < hw and abs(p.y - c['lat']) < hw and (pid != 'AR-C' or t['PROV'][i] == '02')]
    radios = [scale(GEOM[i], xfact=cf, yfact=1, origin=(0, 0)) for i in idx]
    tree = STRtree(radios)
    pops = [t['POB_TOT_P'][i] or 0 for i in idx]

    # 1) barrios OSM disjuntos + población
    taken, bar_geoms = None, []
    for z in barrios:
        polys = [Polygon([to_m(*map(float, q.split())) for q in re.split(r'L', ring) if q.strip()]).buffer(0)
                 for ring in re.findall(r'M([^Z]*)Z', z['d'])]
        g = unary_union([p for p in polys if p.area > 0]) if polys else Polygon()
        if taken is not None and not g.is_empty:
            g = g.difference(taken)
        taken = g if taken is None else unary_union([taken, g])
        bar_geoms.append(g)
        pop = sum(pops[j] * g.intersection(radios[j]).area / radios[j].area for j in tree.query(g) if radios[j].area > 0) if not g.is_empty else 0
        km2 = g.area * KM ** 2
        z.update(tipo='barrio', pop=int(round(pop)), areaKm2=round(km2, 3), densidad=round(pop / km2) if km2 else 0, popFuente='censo2022')
        z['d'] = ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in (to_svg(*q) for q in p.simplify(0.4 / k).exterior.coords)) + 'Z'
                         for p in parts(g) if p.geom_type == 'Polygon' and not p.is_empty) or z['d']

    # 2) fracciones censales sobre el resto del territorio
    groups = collections.defaultdict(list)
    for j, i in enumerate(idx):
        groups[(t['DEPTO'][i], t['FRACC'][i])].append(j)
    fracs = []
    for (dep, fra), js in groups.items():
        U = unary_union([radios[j] for j in js])
        a_km2 = U.area * KM ** 2
        pop_tot = sum(pops[j] for j in js)
        if a_km2 >= RURAL_AREA * bbox_km2 and pop_tot / a_km2 < RURAL_DENS:
            continue
        R = U if taken is None else U.difference(taken)
        if R.is_empty:
            continue
        pop = sum(pops[j] * R.intersection(radios[j]).area / radios[j].area for j in js if radios[j].area > 0)
        km2 = R.area * KM ** 2
        if km2 < 0.02 or pop < 20:
            continue
        d = ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in (to_svg(*q) for q in p.simplify(0.5 / k).exterior.coords)) + 'Z'
                    for p in parts(R) if p.geom_type == 'Polygon' and p.area * KM ** 2 > 0.005)
        if not d:
            continue
        rp = to_svg(*R.representative_point().coords[0])
        fracs.append({'nombre': f'Zona {dep}-{fra}', 'tipo': 'fraccion', 'd': d, 'cx': round(rp[0], 1), 'cy': round(rp[1], 1),
                      'pop': int(round(pop)), 'areaKm2': round(km2, 3), 'densidad': round(pop / km2), 'popFuente': 'censo2022'})
    fracs.sort(key=lambda z: -z['pop'])

    for i, z in enumerate(barrios): z['id'] = f'b{i}'
    for i, z in enumerate(fracs): z['id'] = f'f{i}'
    city['zonas'] = barrios + fracs
    city['poblacionBarrios'] = sum(z['pop'] for z in barrios)
    city['poblacionTotal'] = sum(z['pop'] for z in city['zonas'])
    city['fuentePoblacion'] = 'INDEC Censo 2022 / Rodriguez & de Grande (CONICET), radios censales, CC-BY-4.0'
    json.dump(city, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(pid, c['ciudad'], '| barrios', len(barrios), 'pob', city['poblacionBarrios'], '| fracciones', len(fracs),
          '| total zonas', len(city['zonas']), 'pob total', city['poblacionTotal'], f'| {f.stat().st_size // 1024} KB')
