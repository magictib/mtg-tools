#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// CSV parsing function
function parseCSV(txt) {
  const lines = txt.trim().split(/\r?\n/);
  const sep = (txt.match(/,/g) || []).length > (txt.match(/;/g) || []).length ? ',' : ';';
  
  function parseLine(line) {
    const res = [], cur = [];
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if (c === sep && !inQuote) {
        res.push(cur.join('').trim());
        cur.length = 0;
      } else {
        cur.push(c);
      }
    }
    res.push(cur.join('').trim());
    return res;
  }
  
  const hdrs = parseLine(lines[0]);
  const data = lines.slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = parseLine(l);
      const obj = {};
      hdrs.forEach((h, i) => {
        obj[h] = (vals[i] || '').replace(/^"|"$/g, '');
      });
      return obj;
    });
  
  return { hdrs, data };
}

// Condition mapping
const C2S = {
  'Near Mint': 'NM',
  'Lightly Played': 'LP',
  'Moderately Played': 'MP',
  'Heavily Played': 'HP',
  'Damaged': 'D'
};

function cs(v) {
  return C2S[v] || v;
}

function fNF(v) {
  return ['Foil', 'foil', '✓'].includes(v) ? 'foil' : 'nonfoil';
}

// Convert Mythic Tools (B) → CardNexus (A)
function convertBARow(row) {
  return {
    'name': (row['Card Name'] || '').replace(/\s*\/{1,2}\s*.+$/, '').trim(),
    'expansion': row['Set Name'] || '',
    'printNumber': row['Collector Number'] || '',
    'rarity': row['Rarity'] || '',
    'language': row['Language'] || '',
    'totalQtyOwned': row['Quantity'] || '1',
    'condition': cs(row['Condition'] || ''),
    'finish': fNF(row['Finish'] || ''),
    'price': row['Price (EUR)'] || '0',
    'game': 'Magic: The Gathering',
    'variant': '',
    'color': '',
    'colorIdentity': '',
    'finishes': '',
    'types': '',
    'description': ''
  };
}

// CSV generation function
function generateCSV(rows) {
  if (!rows.length) return '';
  
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(h => `"${h}"`).join(',');
  
  const dataLines = rows.map(row => {
    return headers.map(h => {
      const val = row[h] || '';
      const needsQuote = val.includes(',') || val.includes('"') || val.includes('\n');
      return needsQuote ? `"${val.replace(/"/g, '""')}"` : `"${val}"`;
    }).join(',');
  });
  
  return headerLine + '\n' + dataLines.join('\n');
}

// Main conversion
function main() {
  const inputFile = process.argv[2] || 'list_4_2026-04-22T18-30-37-990Z.csv';
  
  if (!fs.existsSync(inputFile)) {
    console.error(`Fichier non trouvé: ${inputFile}`);
    process.exit(1);
  }
  
  const txt = fs.readFileSync(inputFile, 'utf-8');
  const { data } = parseCSV(txt);
  
  console.log(`Conversion de ${data.length} cartes...`);
  
  const converted = data.map(convertBARow);
  const csv = generateCSV(converted);
  
  const outputFile = 'inventory_cardnexus.csv';
  fs.writeFileSync(outputFile, csv, 'utf-8');
  
  console.log(`✓ Fichier généré: ${outputFile}`);
  console.log(`Statistiques: ${converted.length} entrées`);
}

main();
