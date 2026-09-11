/**
 * docxgenerator.js - Convierte una clase (bloque de texto) en un documento Word (.docx).
 * Traduce la lógica del script Python generar_clases.py al mismo estilo.
 * Usa window.DocxLib (bundle de "docx" + "file-saver") y window.ChemFormat.
 * API de docx v9: construcción declarativa con children[] por sección.
 */
(function (global) {
  "use strict";

  const D = global.DocxLib?.docx;
  if (!D) throw new Error("DocxLib no cargado");

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  } = D;

  // ------------------------------------------------------------
  // Helpers de "runs" con soporte de subíndices/superíndices
  // ------------------------------------------------------------
  function runsDeTexto(texto) {
    const segs = global.ChemFormat ? global.ChemFormat.parseChemRuns(texto) : [{ text: texto }];
    return segs.map(
      (s) =>
        new TextRun({
          text: s.text, subScript: !!s.sub, superScript: !!s.sup,
          size: 22, font: "Calibri", fontFamily: "Calibri",
        })
    );
  }

  // ------------------------------------------------------------
  // Versión declarativa de las funciones del script Python.
  // Cada helper devuelve elementos para el array children[].
  // ------------------------------------------------------------
  function title(text, level) {
    const color = level === 0 ? "0F3460" : level === 1 ? "1A4D8F" : "2E9CC4";
    const size = level === 0 ? 34 : level === 1 ? 27 : 23;
    const heading = level === 0 ? HeadingLevel.TITLE : level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size, color, font: "Calibri" })],
      heading,
      spacing: { before: level === 0 ? 0 : 160, after: 100 },
    });
  }

  function titleCentrado(text) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 30, color: "0F3460", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    });
  }

  function subtituloCentrado(text) {
    return new Paragraph({
      children: [new TextRun({ text, italic: true, size: 24, color: "555555", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    });
  }

  function boldLine(label, value) {
    return new Paragraph({
      children: [
        new TextRun({ text: label, bold: true, size: 22, font: "Calibri" }),
        ...runsDeTexto(value || ""),
      ],
      spacing: { before: 50, after: 50 },
    });
  }

  function parrafo(texto) {
    return new Paragraph({
      children: runsDeTexto(texto),
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 40, after: 60 },
    });
  }

  function viñeta(texto) {
    return new Paragraph({
      children: runsDeTexto(texto.replace(/^[-•–·]\s*/, "• ")),
      bullet: { level: 0 },
      spacing: { before: 20, after: 30 },
    });
  }

  function numerada(texto) {
    return new Paragraph({
      children: runsDeTexto(texto),
      numbering: { reference: "num-clase", level: 0 },
      spacing: { before: 20, after: 30 },
    });
  }

  function tabla(headers, rows) {
    const borde = { style: BorderStyle.SINGLE, size: 4, color: "8FABC0" };
    const cols = Math.max(headers.length, ...rows.map((r) => r.length));
    const pct = cols ? Math.round(100 / cols) : 50;

    const mkCell = (text, isHeader) =>
      new TableCell({
        children: [new Paragraph({ children: runsDeTexto(String(text ?? "")) })],
        width: { size: pct, type: WidthType.PERCENTAGE },
        shading: isHeader ? { type: ShadingType.CLEAR, fill: "DCE6F1", color: "auto" } : undefined,
      });

    const filas = [
      new TableRow({ tableHeader: true, children: headers.map((h) => mkCell(h, true)) }),
      ...rows.map((r) => new TableRow({ children: Array.from({ length: cols }, (_, i) => mkCell(r[i] ?? "", false)) })),
    ];

    return new Table({
      rows: filas,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: borde, bottom: borde, left: borde, right: borde, insideH: borde, insideV: borde },
    });
  }

  // ------------------------------------------------------------
  // Detección de estructura por línea
  // ------------------------------------------------------------
  const PAT_SECCION = /^(?:I{1,3}|IV|V{1,3}|VI{1,3}|VII{1,3}|VIII|IX|X)\.[\.\)]?\s+[A-ZÁÉÍÓÚÑ].{0,60}$/;
  const SECCIONES_CORTAS = new RegExp(
    "^(Objetivo|Objetivos|Conceptos fundamentales|Desarrollo de la clase|Introducción|Motivación|" +
    "Conclusiones|Evaluación|Tarea|Tareas|Pizarra final|Pizarra|Sistematización|Aplicación|" +
    "Importancia de la Química|La Química en la vida cotidiana y en Cuba|Química medioambiental|" +
    "Fijación del contenido|Elaboración conjunta|Ejercitación|Atención a las diferencias individuales|" +
    "Orientaciones metodológicas|Resumen para la pizarra|CUADRO RESUMEN|IDEAS? CENTRALES?|" +
    "Aseguramiento del nivel de partida|Orientación del estudio independiente|" +
    "Actividad de elaboración conjunta|Orientación hacia el objetivo|Motivación y orientación" +
    "|Trabajo con modelos de partículas)", "i");
  const PAT_VIÑETA = /^[-•–·]\s/;
  const PAT_NUMERADA = /^\d+[.)](\s|$)/;

  function esTabla(fila) {
    const f = fila.trim();
    return f.includes("\t") || /^\|.*\|$/.test(f);
  }

  function dividirFila(f) {
    if (f.includes("\t")) return f.split("\t").map((c) => c.trim());
    if (/^\|.*\|$/.test(f)) return f.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    return [f];
  }

  // ------------------------------------------------------------
  // GENERADOR PRINCIPAL (por clase)
  // ------------------------------------------------------------
  function construirDocumento(clase) {
    const children = [];

    // Portada
    children.push(titleCentrado("Planificación de Clase"));
    children.push(subtituloCentrado(clase.asignatura + (clase.grado ? " " + clase.grado + " grado" : "")));
    if (clase.tema) children.push(title("Tema: " + clase.tema, 1));

    // Metadatos
    const meta = clase.meta || {};
    const orden = ["Asignatura", "Grado", "Unidad", "Tema", "Tipo de clase", "Tiempo", "Método", "Procedimientos", "Forma de organización", "Medios de enseñanza", "Medios"];
    const metasValores = orden.filter((k) => meta[k]);
    if (metasValores.length) {
      children.push(title("Datos generales", 1));
      for (const clave of metasValores) children.push(boldLine(clave + ": ", meta[clave]));
    }

    // Cuerpo
    const lineas = clase.lineas || [];
    let i = 0;
    while (i < lineas.length) {
      const linea = lineas[i].trim();
      if (!linea) { i++; continue; }

      // Tabla (filas consecutivas con tab o pipes)
      if (esTabla(linea)) {
        const filas = [];
        while (i < lineas.length && esTabla(lineas[i])) { filas.push(dividirFila(lineas[i])); i++; }
        if (filas.length) children.push(tabla(filas[0], filas.slice(1)));
        children.push(new Paragraph({ children: [] }));
        continue;
      }

      // Secciones romanas "I. Introducción - 10 minutos"
      if (PAT_SECCION.test(linea)) { children.push(title(linea, 2)); i++; continue; }

      // Secciones cortas "Objetivo", "Motivación"...
      if (SECCIONES_CORTAS.test(linea) && linea.length < 45) { children.push(title(linea, 1)); i++; continue; }

      // Viñetas
      if (PAT_VIÑETA.test(linea)) { children.push(viñeta(linea)); i++; continue; }

      // Listas numeradas "1. ..."
      if (PAT_NUMERADA.test(linea)) { children.push(numerada(linea)); i++; continue; }

      // Etiqueta "Clave: valor"
      const m = linea.match(/^([A-ZÁÉÍÓÚÑ][^:]{1,45}):\s+(.+)$/);
      if (m && linea.length < 220) { children.push(boldLine(m[1] + ": ", m[2])); i++; continue; }

      // Párrafo normal
      children.push(parrafo(linea));
      i++;
    }

    return new Document({
      styles: {
        default: { font: "Calibri", size: 22, run: { font: "Calibri", size: 22 } },
        paragraphStyles: [],
      },
      numbering: {
        config: [{ reference: "num-clase", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "start", prefix: "", suffix: "" }] }],
      },
      sections: [{ children }],
    });
  }

  /**
   * Genera el .docx para una clase.
   * @returns {Promise<{blob:Blob, nombre:string}>}
   */
  async function generarDocx(clase, nombre) {
    const doc = construirDocumento(clase);
    const arrayBuffer = await Packer.toArrayBuffer(doc);
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    return { blob, nombre: nombre || clase.nombre || "clase.docx" };
  }

  global.DocxGen = { generarDocx, construirDocumento };
})(window);