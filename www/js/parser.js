/**
 * parser.js - Detecta y separa las planificaciones de clase dentro de un texto pegado.
 * La detección se basa en los patrones típicos de la planificación cubana:
 * "Química 8.º grado", "PLAN DE CLASE DE QUÍMICA – 9.º GRADO", "Clase de Geografía...",
 * "TRABAJO PRÁCTICO DE GEOGRAFÍA FÍSICA...", separadores manuales "=== CLASE ===".
 */
(function (global) {
  "use strict";

  // Quita emojis/iconos que imprimen los celulares al inicio de línea.
  function limpiarEmoji(linea) {
    return linea.replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\s]+/u, "");
  }

  /** ¿Esta línea marca el comienzo de una nueva clase? */
  function iniciaClase(linea) {
    const t = limpiarEmoji(linea).trim();
    if (!t) return false;

    // Separador manual que el usuario puede escribir: "=== CLASE ==="
    if (/^===\s*CLASE\s*===$/i.test(t)) return true;

    // "Química 8.º grado" / "QUÍMICA – 8.º GRADO" / "Geografía Física – 7.º grado"
    if (/^(QUÍMICA|GEOGRAFÍA)\s*[-–—:]?\s*\d+\.?\s*º/i.test(t)) return true;
    if (/^(Química|Geografía\s+(física|económica\s+y\s+social))\b/i.test(t) &&
        /\d+\.?\s*º\s*(grado|GRADO)?/i.test(t)) return true;

    // "PLAN DE CLASE DE QUÍMICA..." / "PLANIFICACIÓN DE CLASE..."
    if (/^PLAN(IFICACIÓN)?\s+(DE\s+)?CLASE\b/i.test(t)) return true;
    if (/^Planificación\s+de\s+(clase|la\s+clase)/i.test(t)) return true;

    // "Clase de Geografía Económica y Social – 8.º grado" / "Clase de sistematización..."
    if (/^Clase\s+de\s+(sistematización|Geografía|Química)/i.test(t)) return true;

    // "TRABAJO PRÁCTICO DE GEOGRAFÍA FÍSICA – 7.º GRADO"
    if (/^TRABAJO\s+PRÁCTICO\b/i.test(t)) return true;
    if (/^Trabajo\s+práctico\b/i.test(t)) return true;

    return false;
  }

  // Campos de metadatos que aparecen al inicio de las planificaciones.
  const CAMPOS_META = [
    "Asignatura", "Grado", "Unidad", "Tema", "Subtema", "Tipo de clase",
    "Tiempo", "Método", "Procedimientos", "Forma de organización",
    "Medios de enseñanza", "Medios", "Fecha", "Nivel", "Lugar",
  ];

  function extraerMeta(lineas) {
    const meta = {};
    for (let i = 0; i < lineas.length; i++) {
      const raw = lineas[i].trim();
      if (!raw) continue;
      const m = raw.match(/^([A-ZÁÉÍÓÚÑ][^\s:]*[^\s:]*|Asignatura|Grado|Unidad|Tema|Tipo de clase|Forma de organización|Medios de enseñanza|Tiempo|Método|Procedimientos)\s*:\s*(.*)$/i);
      if (m) {
        const clave = m[1].toLowerCase();
        const norma = CAMPOS_META.find((c) => c.toLowerCase() === clave);
        if (!norma) continue;
        let valor = m[2].trim();
        // Valor en la siguiente línea (formato "Tema:\nLas sales")
        if (!valor && i + 1 < lineas.length) {
          const next = lineas[i + 1].trim();
          if (next && !/^[A-ZÁÉÍÓÚÑ][^\s:]{1,}:\s/.test(next)) {
            valor = next;
            i++; // consumir línea
          }
        }
        if (valor && !meta[norma]) meta[norma] = limpiarEmoji(valor);
      }
    }
    return meta;
  }

  function detectarAsignatura(textoCompleto) {
    if (/Geografía\s+Económica\s+y\s+Social/i.test(textoCompleto)) return "Geografía Económica y Social";
    if (/Geografía\s+Física/i.test(textoCompleto)) return "Geografía Física";
    if (/GEOGRAFÍA/i.test(textoCompleto)) return "Geografía";
    if (/QUÍMICA|Química/i.test(textoCompleto)) return "Química";
    return "Clase";
  }

  function detectarGrado(textoCompleto) {
    const m = textoCompleto.match(/(\d+)[.,]?\s*º\s*(grado|GRADO)?/);
    if (m) return m[1] + ".º";
    const g = textoCompleto.match(/[Gg]rado:\s*(\d+)/);
    if (g) return g[1] + ".º";
    return "";
  }

  function nombreArchivo(asignatura, grado, tema) {
    const base = [asignatura, grado, tema].filter((x) => x).join("_");
    return base
      .toLowerCase()
      .replace(/[^a-z0-9._áéíóúñü]+/gi, "_")
      .replace(/_{2,}/g, "_")
      .replace(/\._/g, "_")
      .replace(/[._]+$/g, "")
      .replace(/^_|_$/g, "")
      .slice(0, 70) + ".docx";
  }

  /**
   * Divide el texto pegado en clases.
   * @param {string} texto
   * @returns {Array<{id:number,title:string,asignatura:string,grado:string,tema:string,nombre:string,meta:Object,lineas:string[],numerolineas:number}>}
   */
  function parseClases(texto) {
    if (!texto || !texto.trim()) return [];
    const lineas = texto.split(/\r?\n/);
    const bloques = [];
    let actual = [];

    for (const linea of lineas) {
      if (iniciaClase(linea)) {
        if (actual.length) bloques.push(actual);
        actual = [linea];
      } else {
        actual.push(linea);
      }
    }
    if (actual.length) bloques.push(actual);

    const clases = [];
    bloques.forEach((block, idx) => {
      const textoBloque = block.join("\n");
      if (!textoBloque.trim()) return;

      const meta = extraerMeta(block);
      const asignatura = meta.Asignatura || detectarAsignatura(textoBloque);
      const grado = meta.Grado || detectarGrado(textoBloque);
      const tema = meta.Tema || "";

      // Título presentable: primer renglón no vacío (sin "=== CLASE ===")
      let title = "";
      for (const l of block) {
        const tr = limpiarEmoji(l).trim();
        if (tr && !/^===\s*CLASE\s*===/i.test(tr)) {
          title = tr;
          break;
        }
      }
      if (tema && title.toLowerCase().indexOf(tema.toLowerCase()) === -1) {
        title = (title ? title + " — " : "") + tema;
      }

      clases.push({
        id: idx + 1,
        title: title.slice(0, 120),
        asignatura,
        grado,
        tema,
        nombre: nombreArchivo(asignatura, grado, tema) || "clase_" + (idx + 1) + ".docx",
        meta,
        lineas: block.slice(),
        numerolineas: block.length,
      });
    });
    return clases;
  }

  global.Parser = { parseClases, iniciaClase };
})(window);