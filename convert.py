#!/usr/bin/env python3
import csv
import sys
import os

def strip_dfc(name):
    import re
    return re.sub(r'\s*/{1,2}\s*.+$', '', (name or '')).strip()

# Convert Mythic Tools (B) → CardNexus (A)
def convert_row(row):
    finish = row.get('Finish', '').lower()
    is_foil = finish in ['foil', '✓', 'foil']
    
    return {
        'totalQtyOwned': row.get('Quantity', '1'),
        'name': strip_dfc(row.get('Card Name', '')),
        'printNumber': row.get('Collector Number', ''),
        'finish': 'Foil' if is_foil else 'Standard',
        'variant': '',
        'expansion': row.get('Set Name', ''),
        'game': 'Magic: The Gathering',
        'condition': row.get('Condition', ''),
        'language': row.get('Language', ''),
        'price': row.get('Price (EUR)', '0')
    }

def main():
    input_file = sys.argv[1] if len(sys.argv) > 1 else 'list_4_2026-04-22T18-30-37-990Z.csv'
    
    if not os.path.exists(input_file):
        print(f'Fichier non trouvé: {input_file}')
        sys.exit(1)
    
    # Read input CSV
    rows = []
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    
    print(f'Conversion de {len(rows)} cartes...')
    
    # Convert rows
    converted = [convert_row(row) for row in rows]
    
    # Write output CSV with correct column order
    output_file = 'inventory_cardnexus.csv'
    headers = ['totalQtyOwned', 'name', 'printNumber', 'finish', 'variant', 'expansion', 'game', 'condition', 'language', 'price']
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(converted)
    
    print(f'✓ Fichier généré: {output_file}')
    print(f'Statistiques: {len(converted)} entrées')
    
    # Calculate stats
    total_qty = sum(int(row.get('totalQtyOwned', 1)) for row in converted if str(row.get('totalQtyOwned', '1')).isdigit())
    total_value = sum(float(row.get('price', 0)) * int(row.get('totalQtyOwned', 1)) 
                      for row in converted 
                      if str(row.get('totalQtyOwned', '1')).isdigit())
    sets_count = len(set(row.get('expansion', '') for row in converted if row.get('expansion', '')))
    
    print(f'  • Cartes: {total_qty}')
    print(f'  • Valeur (EUR): {total_value:.2f}€')
    print(f'  • Extensions: {sets_count}')

if __name__ == '__main__':
    main()
