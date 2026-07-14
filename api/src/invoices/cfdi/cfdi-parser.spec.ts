import { parseCfdiXml } from './cfdi-parser';

const CFDI_40 = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  Version="4.0" Folio="A-123" Fecha="2026-05-10T12:00:00"
  SubTotal="1000.00" Total="1160.00" Moneda="MXN" MetodoPago="PPD">
  <cfdi:Emisor Rfc="lan180423qf1" Nombre="Logística Andrade"/>
  <cfdi:Receptor Rfc="roy200101aaa" Nombre="Royáltica"/>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      UUID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

describe('parseCfdiXml', () => {
  it('extrae los campos fiscales de un CFDI 4.0 y normaliza RFC/UUID', () => {
    const r = parseCfdiXml(CFDI_40);
    expect(r.cfdiUuid).toBe('A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
    expect(r.rfcEmisor).toBe('LAN180423QF1');
    expect(r.rfcReceptor).toBe('ROY200101AAA');
    expect(r.subtotal).toBe(1000);
    expect(r.iva).toBe(160);
    expect(r.total).toBe(1160);
    expect(r.currency).toBe('MXN');
    expect(r.folio).toBe('A-123');
    expect(r.paymentType).toBe('PPD');
    expect(r.emisorNombre).toBe('Logística Andrade');
  });

  it('infiere el IVA como total - subtotal si falta TotalImpuestosTrasladados', () => {
    const sinImpuestos = CFDI_40.replace(
      /<cfdi:Impuestos[^>]*\/>/,
      '',
    );
    const r = parseCfdiXml(sinImpuestos);
    expect(r.iva).toBe(160);
  });

  it('lanza si el XML no tiene UUID de timbre', () => {
    const sinUuid = CFDI_40.replace(/UUID="[^"]*"/, '');
    expect(() => parseCfdiXml(sinUuid)).toThrow();
  });

  it('lanza si el XML no es un CFDI', () => {
    expect(() => parseCfdiXml('<root><a/></root>')).toThrow();
  });
});
