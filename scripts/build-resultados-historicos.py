"""Genera data/resultados-historicos.json: Presidente y Vice por provincia, generales 2019 y 2023.
 - 2019: DINE, escrutinio DEFINITIVO por distrito (xlsx en data/fuentes/).
 - 2023: DINE, escrutinio PROVISORIO a nivel mesa (CSV de ~1 GB, NO se guarda en el repo); se agrega aquí.
Uso: python -I scripts/build-resultados-historicos.py <ResultadoElectorales_2023_Generales.csv>"""
import csv, json, sys
import openpyxl

# Los 24 distritos van en el mismo orden en ambas fuentes (id 1..24 en 2023; hojas 2..25 en 2019)
ISO = ['AR-C', 'AR-B', 'AR-K', 'AR-X', 'AR-W', 'AR-H', 'AR-U', 'AR-E', 'AR-P', 'AR-Y', 'AR-L', 'AR-F', 'AR-M', 'AR-N',
       'AR-Q', 'AR-R', 'AR-A', 'AR-J', 'AR-D', 'AR-Z', 'AR-S', 'AR-G', 'AR-T', 'AR-V']
OTROS_MIN = 0.01   # agrupaciones con <1% de los votos positivos se agrupan en "OTROS"

def compactar(votos):
    tot = sum(votos.values())
    res, otros = {}, 0.0
    for k, v in sorted(votos.items(), key=lambda kv: -kv[1]):
        p = v / tot
        if p >= OTROS_MIN: res[k] = round(p, 4)
        else: otros += p
    if otros: res['OTROS'] = round(otros, 4)
    return res

out = {iso: {} for iso in ISO}

# ---- 2019 (definitivo) ----
wb = openpyxl.load_workbook('data/fuentes/dine-2019-presidente-definitivo-x-distrito.xlsx', data_only=True)
for iso, name in zip(ISO, wb.sheetnames[1:]):
    ws, votos, electores, particip = wb[name], {}, None, None
    for r in ws.iter_rows(values_only=True):
        lbl = str(r[1] or '').strip()
        if lbl == 'ELECTORES HABILES': electores = int(r[2])
        elif lbl == 'PORCENTAJE DE VOTANTES': particip = float(r[2])
        elif r[0] is not None and isinstance(r[2], (int, float)): votos[lbl] = r[2]
    out[iso]['2019'] = {'tipo': 'generales', 'cargo': 'Presidente y Vice', 'escrutinio': 'definitivo', 'electores': electores,
                        'participacion': round(particip, 4), 'resultados': compactar(votos)}

# ---- 2023 (provisorio, por mesa) ----
votos = [dict() for _ in ISO]; mesas = [dict() for _ in ISO]; votantes = [0] * len(ISO)
with open(sys.argv[1], encoding='utf-8', newline='') as f:
    for r in csv.DictReader(f):
        if r['cargo_nombre'] != 'PRESIDENTE Y VICE': continue
        d = int(r['distrito_id']) - 1
        n = int(r['votos_cantidad'])
        votantes[d] += n
        mesas[d][(r['seccion_id'], r['circuito_id'], r['mesa_id'])] = int(r['mesa_electores'])
        if r['votos_tipo'] == 'POSITIVO':
            votos[d][r['agrupacion_nombre']] = votos[d].get(r['agrupacion_nombre'], 0) + n
for d, iso in enumerate(ISO):
    el = sum(mesas[d].values())
    out[iso]['2023'] = {'tipo': 'generales', 'cargo': 'Presidente y Vice', 'escrutinio': 'provisorio', 'electores': el,
                        'participacion': round(votantes[d] / el, 4), 'resultados': compactar(votos[d])}

json.dump({'fuentes': 'DINE (Ministerio del Interior). 2019 definitivo; 2023 provisorio, 1ª vuelta. Ver data/fuentes/README.md',
           'distritos': out}, open('data/resultados-historicos.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for y in ('2019', '2023'):
    print(y, 'electores', sum(out[i][y]['electores'] for i in ISO), '| ganador por distrito:',
          {i: max(out[i][y]['resultados'], key=out[i][y]['resultados'].get)[:12] for i in ISO[:4]})
