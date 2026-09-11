/**
 * chemformat.js - Detecta fórmulas químicas y partículas (H₂O, NaCl, Na⁺, SO₄²⁻, Fe²⁺/³⁺...)
 * y las divide en segmentos con marca de subíndice/superíndice para que el generador
 * de Word las escriba con el formato tipográfico correcto.
 */
(function (global) {
  "use strict";

  // Subíndices unicode (los que ya vienen en el texto pegado desde WhatsApp)
  const SUB_UNICODE = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };
  // Superíndices unicode (cargas iónicas y exponentes)
  const SUP_UNICODE = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁺": "+", "⁻": "-" };

  /**
   * Convierte un texto en una lista de segmentos:
   *   { text: string, sub?: boolean, sup?: boolean }
   * Ej: "Na₂SO₄"  → [{text:"Na"}, {text:"2",sub},{text:"SO"}, {text:"4",sub}]
   *     "FeCl₃"   → [{text:"FeCl"}, {text:"3",sub}]
   *     "Na⁺"     → [{text:"Na"}, {text:"+",sup}]
   * También reconoce formas "planas": H2O, CaCl2, Fe2+, SO4(2-), etc.
   */
  function parseChemRuns(texto) {
    if (!texto) return [{ text: "" }];

    // 1) Normalizar unicode a marcadores @SUB@ / @SUP@
    let t = String(texto);
    for (const [uni, plano] of Object.entries(SUB_UNICODE)) t = t.split(uni).join("@SUB" + plano + "@");
    for (const [uni, plano] of Object.entries(SUP_UNICODE)) t = t.split(uni).join("@SUP" + plano + "@");

    // 2) Detectar formas planas con regex.
    //    a) Números que son subíndices: precedidos por letra o ")" o "]" y que NO son año grande:
    //       H2O, CaCl2, Al2(SO4)3, CO2 ...
    t = t.replace(/([A-Za-z)\]])[0-9]+\b(?!º|\.|;|,|:|\/)/g, (m, p1) => {
      // Solo convertimos números cortos (1-3 dígitos) para evitar marcar "H2026".
      const num = m.slice(p1.length);
      if (num.length > 3) return m;
      return p1 + "@SUB" + num + "@";
    });

    //    b) Cargas iónicas en forma plana: Fe2+, SO4(2-), Na+ , (PO4)3- ...
    //       "número+/-" o "+/-" justo después de letra/")"
    t = t.replace(/([A-Za-z)\)\]])([0-9]{0,2}[+-])(?![0-9])/g, "$1@SUP$2@");

    // 3) Segmentar el texto en trozos normales / @SUBn@ / @SUPn@
    const re = /@(SUB|SUP)([^@]+)@/g;
    const segs = [];
    let last = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      if (m.index > last) segs.push({ text: t.slice(last, m.index) });
      segs.push({ text: m[2], sub: m[1] === "SUB", sup: m[1] === "SUP" });
      last = m.index + m[0].length;
    }
    if (last < t.length) segs.push({ text: t.slice(last) });

    // Limpiar segmentos vacíos
    return segs.filter((s) => s.text.length > 0);
  }

  global.ChemFormat = { parseChemRuns };
})(window);