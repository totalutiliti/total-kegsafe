import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

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
  async parseFile(
    buffer: Buffer,
    _filename: string,
  ): Promise<Record<string, any>[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      const val = cell.value;
      headers[colNumber - 1] =
        typeof val === 'string' ? val : val != null ? JSON.stringify(val) : '';
    });

    const rows: Record<string, any>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        obj[header] = cell.value ?? null;
      });
      rows.push(obj);
    });

    return rows;
  }

  /**
   * Gera um template Excel (.xlsx) com cabeçalhos, exemplos e aba de instruções.
   */
  async generateTemplate(
    columns: ExcelColumn[],
    examples: Record<string, any>[] = [],
    instructions?: string[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Aba de dados
    const sheet = workbook.addWorksheet('Dados');
    sheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || 15,
    }));
    for (const ex of examples) {
      sheet.addRow(ex);
    }

    // Aba de instruções
    if (instructions && instructions.length > 0) {
      const instrSheet = workbook.addWorksheet('Instruções');
      instrSheet.columns = [
        { header: 'Campo', key: 'field', width: 25 },
        { header: 'Exemplo', key: 'example', width: 30 },
        { header: 'Obrigatoriedade', key: 'required', width: 15 },
      ];
      for (const c of columns) {
        instrSheet.addRow({
          field: c.header,
          example: c.example || '',
          required: c.key === 'qrCode' ? 'Obrigatório' : 'Opcional',
        });
      }
      instrSheet.addRow({});
      for (const i of instructions) {
        instrSheet.addRow({ field: i });
      }
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Gera um arquivo Excel a partir de dados.
   */
  async generateFromData(
    columns: ExcelColumn[],
    data: Record<string, any>[],
    sheetName = 'Dados',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || 15,
    }));
    for (const row of data) {
      sheet.addRow(row);
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
