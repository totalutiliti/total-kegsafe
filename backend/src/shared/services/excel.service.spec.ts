import { ExcelService, ExcelColumn } from './excel.service';
import ExcelJS from 'exceljs';

describe('ExcelService', () => {
  let service: ExcelService;

  beforeEach(() => {
    service = new ExcelService();
  });

  async function createTestBuffer(
    rows: any[][],
    sheetName = 'Dados',
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    for (const row of rows) {
      ws.addRow(row);
    }
    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  describe('parseFile', () => {
    it('deve parsear um arquivo xlsx com header + dados', async () => {
      const buffer = await createTestBuffer([
        ['qrCode', 'fabricante', 'capacidade'],
        ['QR-001', 'Franke', 50],
        ['QR-002', 'Portinox', 30],
      ]);

      const result = await service.parseFile(buffer, 'test.xlsx');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        qrCode: 'QR-001',
        fabricante: 'Franke',
        capacidade: 50,
      });
      expect(result[1]).toEqual({
        qrCode: 'QR-002',
        fabricante: 'Portinox',
        capacidade: 30,
      });
    });

    it('deve retornar array vazio para planilha sem dados (só header)', async () => {
      const buffer = await createTestBuffer([
        ['qrCode', 'fabricante', 'capacidade'],
      ]);

      const result = await service.parseFile(buffer, 'empty.xlsx');

      expect(result).toHaveLength(0);
    });

    it('deve preencher campos nulos com null', async () => {
      const buffer = await createTestBuffer([
        ['qrCode', 'fabricante', 'capacidade'],
        ['QR-001', null, 50],
      ]);

      const result = await service.parseFile(buffer, 'nulls.xlsx');

      expect(result).toHaveLength(1);
      expect(result[0]['fabricante']).toBeNull();
    });
  });

  describe('generateTemplate', () => {
    it('deve gerar um xlsx com headers corretos', async () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20 },
        { header: 'fabricante', key: 'fabricante', width: 20 },
      ];

      const buffer = await service.generateTemplate(columns);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Parsear de volta para verificar headers
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet('Dados');
      expect(ws).toBeDefined();
      const headerRow = ws!.getRow(1);
      expect(headerRow.getCell(1).value).toBe('qrCode');
      expect(headerRow.getCell(2).value).toBe('fabricante');
    });

    it('deve incluir exemplos no template', async () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20, example: 'QR-001' },
      ];
      const examples = [{ qrCode: 'QR-EXAMPLE-001' }];

      const buffer = await service.generateTemplate(columns, examples);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet('Dados')!;
      expect(ws.rowCount).toBe(2); // Header + 1 example
      expect(ws.getRow(2).getCell(1).value).toBe('QR-EXAMPLE-001');
    });

    it('deve criar aba de instruções quando fornecida', async () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20, example: 'QR-001' },
      ];
      const instructions = ['Preencha cada linha com os dados de um barril.'];

      const buffer = await service.generateTemplate(columns, [], instructions);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      expect(wb.getWorksheet('Instruções')).toBeDefined();
    });

    it('não deve criar aba de instruções quando não fornecida', async () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20 },
      ];

      const buffer = await service.generateTemplate(columns);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      expect(wb.getWorksheet('Instruções')).toBeUndefined();
    });
  });

  describe('generateFromData', () => {
    it('deve gerar xlsx com dados corretos', async () => {
      const columns: ExcelColumn[] = [
        { header: 'internalCode', key: 'internalCode', width: 22 },
        { header: 'qrCode', key: 'qrCode', width: 20 },
      ];
      const data = [
        { internalCode: 'KS-BAR-000000001', qrCode: '' },
        { internalCode: 'KS-BAR-000000002', qrCode: '' },
      ];

      const buffer = await service.generateFromData(
        columns,
        data,
        'Barris sem QR',
      );

      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet('Barris sem QR')!;
      expect(ws).toBeDefined();
      expect(ws.rowCount).toBe(3); // Header + 2 data rows
      expect(ws.getRow(2).getCell(1).value).toBe('KS-BAR-000000001');
    });

    it('deve usar nome de aba padrão "Dados" quando não especificado', async () => {
      const columns: ExcelColumn[] = [
        { header: 'teste', key: 'teste', width: 10 },
      ];

      const buffer = await service.generateFromData(columns, [
        { teste: 'valor' },
      ]);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      expect(wb.getWorksheet('Dados')).toBeDefined();
    });

    it('deve lidar com dados vazios (só header)', async () => {
      const columns: ExcelColumn[] = [
        { header: 'coluna', key: 'coluna', width: 10 },
      ];

      const buffer = await service.generateFromData(columns, []);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet('Dados')!;
      expect(ws.rowCount).toBe(1); // Only header
    });
  });
});
