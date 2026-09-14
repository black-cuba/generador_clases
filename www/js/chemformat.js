/**
 * chemformat.js - Detecta fórmulas químicas y partículas (H₂O, NaCl, Na⁺, SO₄²⁻, Fe³⁺...)
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
   *     "H2O"     → [{text:"H"}, {text:"2",sub}, {text:"O"}]
   *     "Fe3+"    → [{text:"Fe"}, {text:"3+",sup}]
   *     "SO4 2-"  → [{text:"SO"}, {text:"4",sub}, {text:"2-",sup}]
   */
  function parseChemRuns(texto) {
    if (!texto) return [{ text: "" }];

    let t = String(texto);

    // 1) Normalizar unicode que ya venga en el texto
    for (const [uni, plano] of Object.entries(SUB_UNICODE)) t = t.split(uni).join("«SUB:" + plano + "»");
    for (const [uni, plano] of Object.entries(SUP_UNICODE)) t = t.split(uni).join("«SUP:" + plano + "»");

    // 2a) Cargas de cationes/aniones monoatómicos aislados (sin letra previa): Fe3+, Fe2+, Ca2+, Al3+, O2-, S2-
    t = t.replace(/(?<![A-Za-z])([A-Z][a-z]?)([1-4][+-])(?![0-9\w])/g, "$1«SUP:$2»");

    // 2b) Oxianiones con carga separada por espacio o caret: SO4 2-, (PO4) 3-, CO3 2-, SO4^2-
    t = t.replace(/([A-Z][a-z]?|[)\]])([0-9]{1,3})\s*(?:\^|\s)+([1-4]?[+-]|\([1-4]?[+-]\))(?![0-9\w])/g, (m, elem, sub, charge) => {
      return elem + "«SUB:" + sub + "»«SUP:" + charge.replace(/[()]/g, "") + "»";
    });

    // 2c) Poliatómicos simples con signo único: NO3-, ClO3-, OH-
    t = t.replace(/([A-Z][a-z]?|[)\]])([0-9]{1,3})([+-])(?![0-9\w])/g, (m, elem, sub, sign) => {
      return elem + "«SUB:" + sub + "»«SUP:" + sign + "»";
    });

    // 2d) Cationes y aniones simples sin número: Na+, Cl-, H+, K+, OH-, F-
    t = t.replace(/([A-Za-z)\]»])\s*(?:\^)?([+-])(?![0-9\w])/g, (m, elem, sign) => {
      return elem + "«SUP:" + sign + "»";
    });

    // 3) Subíndices químicos en fórmulas restantes:
    // Letra mayúscula + minúscula opcional (símbolo químico) o ")" o "]" seguido de 1-3 dígitos
    // que NO sean grado ("8.º") ni año grande ("2026") ni números sueltos
    t = t.replace(/([A-Z][a-z]?|[)\]])([0-9]{1,3})(?!º|\.º|[a-z]{3,}|[0-9])/g, (m, elem, num) => {
      return elem + "«SUB:" + num + "»";
    });

    // 4) Segmentar
    const re = /«(SUB|SUP):([^»]+)»/g;
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
})(typeof window !== "undefined" ? window : global);
