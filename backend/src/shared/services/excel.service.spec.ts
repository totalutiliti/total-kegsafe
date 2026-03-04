import { ExcelService, ExcelColumn } from './excel.service';
import * as XLSX from 'xlsx';

describe('ExcelService', () => {
  let service: ExcelService;

  beforeEach(() => {
    service = new ExcelService();
  });

  describe('parseFile', () => {
    it('deve parsear um arquivo xlsx com header + dados', () => {
      // Criar um xlsx em memória
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['qrCode', 'fabricante', 'capacidade'],
        ['QR-001', 'Franke', 50],
        ['QR-002', 'Portinox', 30],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      const buffer = Buffer.from(
        XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
      );

      const result = service.parseFile(buffer, 'test.xlsx');

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

    it('deve parsear um arquivo CSV', () => {
      const csvContent = 'qrCode,fabricante,capacidade\nQR-001,Franke,50\n';
      const wb = XLSX.read(csvContent, { type: 'string' });
      const buffer = Buffer.from(
        XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
      );

      const result = service.parseFile(buffer, 'test.csv');

      expect(result).toHaveLength(1);
      expect(result[0]['qrCode']).toBe('QR-001');
    });

    it('deve retornar array vazio para planilha sem dados (só header)', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['qrCode', 'fabricante', 'capacidade'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      const buffer = Buffer.from(
        XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
      );

      const result = service.parseFile(buffer, 'empty.xlsx');

      expect(result).toHaveLength(0);
    });

    it('deve preencher campos nulos com null (defval)', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['qrCode', 'fabricante', 'capacidade'],
        ['QR-001', null, 50],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      const buffer = Buffer.from(
        XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
      );

      const result = service.parseFile(buffer, 'nulls.xlsx');

      expect(result).toHaveLength(1);
      expect(result[0]['fabricante']).toBeNull();
    });
  });

  describe('generateTemplate', () => {
    it('deve gerar um xlsx com headers corretos', () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20 },
        { header: 'fabricante', key: 'fabricante', width: 20 },
      ];

      const buffer = service.generateTemplate(columns);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Parsear de volta para verificar headers
      const wb = XLSX.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Dados');
      const ws = wb.Sheets['Dados'];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
        header: 1,
      });
      expect(rows[0]).toEqual(['qrCode', 'fabricante']);
    });

    it('deve incluir exemplos no template', () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20, example: 'QR-001' },
      ];
      const examples = [{ qrCode: 'QR-EXAMPLE-001' }];

      const buffer = service.generateTemplate(columns, examples);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets['Dados'];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
        header: 1,
      });
      // Header + 1 exemplo
      expect(rows).toHaveLength(2);
      expect(rows[1]).toEqual(['QR-EXAMPLE-001']);
    });

    it('deve criar aba de instruções quando fornecida', () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20, example: 'QR-001' },
      ];
      const instructions = ['Preencha cada linha com os dados de um barril.'];

      const buffer = service.generateTemplate(columns, [], instructions);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Instruções');
    });

    it('não deve criar aba de instruções quando não fornecida', () => {
      const columns: ExcelColumn[] = [
        { header: 'qrCode', key: 'qrCode', width: 20 },
      ];

      const buffer = service.generateTemplate(columns);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames).not.toContain('Instruções');
    });
  });

  describe('generateFromData', () => {
    it('deve gerar xlsx com dados corretos', () => {
      const columns: ExcelColumn[] = [
        { header: 'internalCode', key: 'internalCode', width: 22 },
        { header: 'qrCode', key: 'qrCode', width: 20 },
      ];
      const data = [
        { internalCode: 'KS-BAR-000000001', qrCode: '' },
        { internalCode: 'KS-BAR-000000002', qrCode: '' },
      ];

      const buffer = service.generateFromData(columns, data, 'Barris sem QR');

      expect(buffer).toBeInstanceOf(Buffer);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Barris sem QR');
      const ws = wb.Sheets['Barris sem QR'];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      expect(rows).toHaveLength(2);
      expect(rows[0]['internalCode']).toBe('KS-BAR-000000001');
    });

    it('deve usar nome de aba padrão "Dados" quando não especificado', () => {
      const columns: ExcelColumn[] = [
        { header: 'teste', key: 'teste', width: 10 },
      ];

      const buffer = service.generateFromData(columns, [{ teste: 'valor' }]);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Dados');
    });

    it('deve lidar com dados vazios (só header)', () => {
      const columns: ExcelColumn[] = [
        { header: 'coluna', key: 'coluna', width: 10 },
      ];

      const buffer = service.generateFromData(columns, []);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets['Dados'];
      const rows = XLSX.utils.sheet_to_json(ws);
      expect(rows).toHaveLength(0);
    });
  });
});
