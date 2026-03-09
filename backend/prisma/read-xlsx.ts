import ExcelJS from 'exceljs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/tjpsa/OneDrive/Desktop/template-importacao-barris_populado.xlsx');
  const ws = wb.worksheets[0];
  console.log('Sheet:', ws.name);
  console.log('Rows:', ws.rowCount);
  console.log('');

  // Header
  const header: string[] = [];
  ws.getRow(1).eachCell((cell) => { header.push(String(cell.value)); });
  console.log('Colunas:', header.join(' | '));
  console.log('');

  // All data rows
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const vals: string[] = [];
    for (let c = 1; c <= header.length; c++) {
      vals.push(String(row.getCell(c).value ?? ''));
    }
    // Skip completely empty rows
    if (vals.every(v => v === '' || v === 'null')) continue;
    console.log(`Row ${r}: ${vals.join(' | ')}`);
  }
}
main().catch(console.error);
