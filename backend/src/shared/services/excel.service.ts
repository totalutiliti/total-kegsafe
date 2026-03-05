import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  example?: string;
}

@Injectable()
export class ExcelService {
  /**
   * Parseia um arquivo Excel (.xlsx/.xls) ou CSV em array de objetos.
   * As chaves dos objetos são os headers da primeira linha.
   */
  parseFile(buffer: Buffer, _filename: string): Record<string, any>[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }

  /**
   * Gera um template Excel (.xlsx) com cabeçalhos, exemplos e aba de instruções.
   */
  generateTemplate(
    columns: ExcelColumn[],
    examples: Record<string, any>[] = [],
    instructions?: string[],
  ): Buffer {
    const workbook = XLSX.utils.book_new();

    // Aba de dados
    const headers = columns.map((c) => c.header);
    const data = examples.map((ex) => columns.map((c) => ex[c.key] ?? ''));
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Definir larguras das colunas
    sheet['!cols'] = columns.map((c) => ({ wch: c.width || 15 }));

    XLSX.utils.book_append_sheet(workbook, sheet, 'Dados');

    // Aba de instruções
    if (instructions && instructions.length > 0) {
      const instrData = [
        ['Instruções de Preenchimento'],
        [],
        ...columns.map((c) => [
          c.header,
          c.example || '',
          c.key === 'qrCode' ? 'Obrigatório' : 'Opcional',
        ]),
        [],
        ...instructions.map((i) => [i]),
      ];
      const instrSheet = XLSX.utils.aoa_to_sheet(instrData);
      instrSheet['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, instrSheet, 'Instruções');
    }

    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
  }

  /**
   * Gera um arquivo Excel a partir de dados.
   */
  generateFromData(
    columns: ExcelColumn[],
    data: Record<string, any>[],
    sheetName = 'Dados',
  ): Buffer {
    const workbook = XLSX.utils.book_new();
    const headers = columns.map((c) => c.header);
    const rows = data.map((row) => columns.map((c) => row[c.key] ?? ''));
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet['!cols'] = columns.map((c) => ({ wch: c.width || 15 }));
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
  }
}
