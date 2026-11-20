"""Genera data/provincias-datos.json (población INDEC 2022 + electores 2025 por provincia)."""
import csv, json, openpyxl

# código INDEC -> ISO usado en el mapa
ISO = {'02':'AR-C','06':'AR-B','10':'AR-K','22':'AR-H','26':'AR-U','14':'AR-X','18':'AR-W','30':'AR-E','34':'AR-P',
       '38':'AR-Y','42':'AR-L','46':'AR-F','50':'AR-M','54':'AR-N','58':'AR-Q','62':'AR-R','66':'AR-A','70':'AR-J',
       '74':'AR-D','78':'AR-Z','82':'AR-S','86':'AR-G','94':'AR-V','90':'AR-T'}
ws = openpyxl.load_workbook('data/fuentes/indec-c2022_tp_est_c1.xlsx', data_only=True)['Cuadro 1 ']
out = {}
for cod, nombre, p2010, p2022, *_ in ws.iter_rows(min_row=1, values_only=True):
    cod = str(cod).zfill(2) if cod not in (None, '') else ''
    if cod in ISO and isinstance(p2022, int):
        out[ISO[cod]] = {'nombre': nombre.split(' (')[0], 'poblacion2010': p2010, 'poblacion2022': p2022}
for row in csv.DictReader(open('data/fuentes/electores-2025.csv', encoding='utf-8')):
    out[row['iso']]['electores2025'] = int(row['electores'])
assert len(out) == 24 and all('electores2025' in v for v in out.values())
tot = sum(v['poblacion2022'] for v in out.values())
assert tot == 45892285, tot
for v in out.values():
    v['electoresPorHabitante'] = round(v['electores2025'] / v['poblacion2022'], 3)
json.dump({'fuentes': 'INDEC Censo 2022 (definitivo); electores 2025: CNE/DINE vía prensa, ver data/fuentes/README.md',
           'provincias': out}, open('data/provincias-datos.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', len(out), 'provincias; población', tot, '; electores', sum(v['electores2025'] for v in out.values()))
