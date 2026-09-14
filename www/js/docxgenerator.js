/**
 * docxgenerator.js - Convierte una clase (bloque de texto) en un documento Word (.docx).
 * Traduce la lógica del script Python generar_clases.py al mismo estilo.
 * Usa window.DocxLib (bundle de "docx" + "file-saver") y window.ChemFormat.
 * API de docx v9: construcción declarativa con children[] por sección.
 */
(function (global) {
  "use strict";

  function getD() {
    const root = typeof window !== "undefined" ? window : global;
    const D = root.DocxLib?.docx;
    if (!D) throw new Error("DocxLib no cargado");
    return D;
  }

  // ------------------------------------------------------------
  // Helpers de "runs" con soporte de subíndices/superíndices
  // ------------------------------------------------------------
  function runsDeTexto(texto) {
    const D = getD();
    const { TextRun } = D;
    const root = typeof window !== "undefined" ? window : global;
    const segs = root.ChemFormat ? root.ChemFormat.parseChemRuns(texto) : [{ text: texto }];
    return segs.map(
      (s) =>
        new TextRun({
          text: s.text, subScript: !!s.sub, superScript: !!s.sup,
          size: 22, font: "Calibri", fontFamily: "Calibri",
        })
    );
  }

  function boldLine(prefijo, texto) {
    const D = getD();
    const { Paragraph, TextRun } = D;
    const runs = runsDeTexto(texto);
    return new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: prefijo, bold: true, size: 22, font: "Calibri", fontFamily: "Calibri" }),
        ...runs,
      ],
    });
  }

  function parrafo(texto) {
    const D = getD();
    const { Paragraph } = D;
    return new Paragraph({ spacing: { after: 100 }, children: runsDeTexto(texto) });
  }

  function title(texto, nivel) {
    const D = getD();
    const { Paragraph, TextRun, HeadingLevel } = D;
    const hl = nivel === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;
    const size = nivel === 1 ? 26 : 24;
    return new Paragraph({
      heading: hl,
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({
          text: texto, bold: true, size, font: "Calibri", fontFamily: "Calibri", color: "1A365D",
        }),
      ],
    });
  }

  function titleCentrado(texto) {
    const D = getD();
    const { Paragraph, TextRun, AlignmentType } = D;
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
      children: [
        new TextRun({
          text: texto, bold: true, size: 28, font: "Calibri", fontFamily: "Calibri", color: "0F2942",
        }),
      ],
    });
  }

  function subtituloCentrado(texto) {
    const D = getD();
    const { Paragraph, TextRun, AlignmentType } = D;
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: texto, italics: true, size: 22, font: "Calibri", fontFamily: "Calibri", color: "4A5568",
        }),
      ],
    });
  }

  function viñeta(texto) {
    const D = getD();
    const { Paragraph } = D;
    const t = texto.replace(/^[-•*]\s*/, "");
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 60 },
      children: runsDeTexto(t),
    });
  }

  function numerada(texto) {
    const D = getD();
    const { Paragraph } = D;
    const t = texto.replace(/^\d+[\.)]\s*/, "");
    return new Paragraph({
      numbering: { reference: "num-clase", level: 0 },
      spacing: { after: 60 },
      children: runsDeTexto(t),
    });
  }

  const PAT_SECCION = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/;
  const SECCIONES_CORTAS = /^(Objetivo|Objetivos|Propósito|Aprendizajes esperados|Motivación|Aseguramiento|Control de la tarea|Inicio|Apertura|Introducción|Desarrollo|Actividades|Secuencia didáctica|Cierre|Conclusión|Conclusiones|Evaluación|Evaluación formativa|Tarea|Estudio independiente|Observaciones|Recursos|Materiales|Orientación hacia el objetivo):?$/i;
  const PAT_VIÑETA = /^[-•*]\s+/;
  const PAT_NUMERADA = /^\d+[\.)]\s+/;

  function esTabla(linea) {
    if (linea.includes("\t")) return true;
    if (linea.startsWith("|") && linea.endsWith("|")) return true;
    return false;
  }

  function celda(texto, esEncabezado) {
    const D = getD();
    const { TableCell, Paragraph, TextRun, WidthType, BorderStyle, ShadingType } = D;
    const b = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
    return new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: b, bottom: b, left: b, right: b },
      shading: esEncabezado ? { fill: "E2E8F0", type: ShadingType.CLEAR } : undefined,
      children: [
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: esEncabezado
            ? [new TextRun({ text: texto, bold: true, size: 20, font: "Calibri", fontFamily: "Calibri" })]
            : runsDeTexto(texto),
        }),
      ],
    });
  }

  function tabla(encabezados, filas) {
    const D = getD();
    const { Table, TableRow, WidthType } = D;
    const rEnc = new TableRow({
      tableHeader: true,
      children: encabezados.map((h) => celda(h, true)),
    });
    const rFilas = filas.map((f) => new TableRow({ children: f.map((c) => celda(c, false)) }));
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [rEnc, ...rFilas],
    });
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
    const D = getD();
    const { Document, Paragraph } = D;
    const children = [];

    // Portada
    children.push(titleCentrado("Planificación de Clase"));
    children.push(subtituloCentrado(clase.asignatura + (clase.grado ? " " + clase.grado + " grado" : "")));
    const temaMostrar = clase.tema || (clase.title && !/^clase\s*\d+$/i.test(clase.title) ? clase.title : "");
    if (temaMostrar) children.push(title("Tema: " + temaMostrar, 1));

    // Metadatos
    const meta = clase.meta || {};
    const orden = ["Asignatura", "Grado", "Unidad", "Tema", "Tipo de clase", "Tiempo", "Método", "Procedimientos", "Forma de organización", "Medios de enseñanza", "Medios"];
    const metasValores = orden.filter((k) => meta[k]);
    if (metasValores.length) {
      children.push(title("Datos generales", 1));
      for (const clave of metasValores) children.push(boldLine(clave + ": ", meta[clave]));
    }

    // Cuerpo (evitando duplicar el encabezado y metadatos)
    const lineas = clase.lineas || [];
    let i = 0;
    let dentroDeEncabezado = true;

    while (i < lineas.length) {
      const linea = lineas[i].trim();
      if (!linea) { i++; continue; }

      // Si aún estamos en la cabecera inicial, omitir líneas repetidas ya colocadas arriba
      if (dentroDeEncabezado) {
        // ¿Es el título o separador que ya se puso en la portada?
        if (/^===\s*CLASE\s*===$/i.test(linea) ||
            /^(?:PLAN(?:IFICACIÓN)?\s+(?:DE\s+)?(?:LA\s+)?CLASE)/i.test(linea) ||
            (temaMostrar && linea.toLowerCase() === temaMostrar.toLowerCase()) ||
            new RegExp(`^(?:${clase.asignatura})\\b`, "i").test(linea)) {
          i++;
          continue;
        }

        // ¿Es una línea de metadato ya incluida en Datos generales?
        const esMetaYaImpreso = metasValores.some((k) => new RegExp(`^${k}\\s*:`, "i").test(linea));
        if (esMetaYaImpreso) {
          i++;
          continue;
        }

        // Al encontrar contenido real (Objetivo, Introducción, Desarrollo, viñetas, etc.), salimos del encabezado
        dentroDeEncabezado = false;
      }

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
        default: { document: { run: { font: "Calibri", size: 22 } } },
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
    const D = getD();
    const { Packer } = D;
    const doc = construirDocumento(clase);
    const arrayBuffer = await Packer.toArrayBuffer(doc);
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    return { blob, nombre: nombre || clase.nombre || "clase.docx" };
  }

  const root = typeof window !== "undefined" ? window : global;
  root.DocxGen = { generarDocx, construirDocumento };
})(typeof window !== "undefined" ? window : global);
