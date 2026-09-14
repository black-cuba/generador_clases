/**
 * parser.js - Detecta y separa las planificaciones de clase dentro de un texto pegado.
 * Preparado para texto escolar cubano y para textos buscados/pegados de Internet sin detalles formales:
 * - Infiere la asignatura por palabras clave si no está escrita.
 * - Detecta temas y títulos de Internet automáticamente.
 * - Separa clases por Clase, Sesión, Lección, Secuencia o === CLASE ===.
 * - Genera nombres de archivo descriptivos sin requerir botones ni configuraciones.
 */
(function (global) {
  "use strict";

  // Quita emojis/iconos que imprimen los celulares al inicio de línea.
  function limpiarEmoji(linea) {
    return linea.replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\s]+/u, "");
  }

  // Lista ampliada de asignaturas del sistema nacional de educación
  const ASIGNATURAS_LISTA = [
    ["Geografía Económica y Social", /Geografía\s+Económica\s+y\s+Social/i],
    ["Geografía Física", /Geografía\s+Física/i],
    ["Geografía", /GEOGRAFÍA|Geografía/i],
    ["Química", /QUÍMICA|Química/i],
    ["Física", /FÍSICA|Física/i],
    ["Biología", /BIOLOGÍA|Biología/i],
    ["Matemática", /MATEMÁTICA|Matemática/i],
    ["Historia de Cuba", /Historia\s+de\s+Cuba/i],
    ["Historia", /HISTORIA|Historia/i],
    ["Español-Literatura", /Español(?:-Literatura)?/i],
    ["Inglés", /INGLÉS|Inglés/i],
    ["Ciencias Naturales", /Ciencias\s+Naturales/i],
    ["Educación Cívica", /Educación\s+Cívica/i],
    ["Educación Laboral", /Educación\s+Laboral/i],
    ["Informática", /INFORMÁTICA|Informática/i],
  ];

  // Inferencia inteligente por contenido si no se menciona la asignatura explícitamente
  const INFERENCIA_TEMATICA = [
    ["Química", /\b(reacci[oó]n|mol[eé]cula|qu[ií]mic|átomo|valencia|enlace|ácido|base|pH|soluci[oó]n|sustancia|tabla peri[oó]dica|oxidaci[oó]n|electr[oó]n|ani[oó]n|cati[oó]n|nomenclatura)\b/i],
    ["Biología", /\b(c[eé]lula|fotos[ií]ntesis|ecosistema|organismo|mitosis|meiosis|cloroplast|adn|arn|flora|fauna|especie|reino animal|tejido|gen[eé]tic|biodiversidad|bacteria|seres vivos)\b/i],
    ["Física", /\b(fuerza|velocidad|aceleraci[oó]n|newton|gravedad|energ[ií]a cin[eé]tica|circuito|voltaje|corriente el[eé]ctrica|[oó]ptica|cinem[aá]tica|termodin[aá]mica|trayectoria)\b/i],
    ["Matemática", /\b(ecuaci[oó]n|fracci[oó]n|fracciones|polinomio|tri[aá]ngulo|geometr[ií]a|[aá]lgebra|teorema|hipotenusa|cateto|per[ií]metro|[aá]rea|par[aá]bola|funci[oó]n lineal|aritm[eé]tica)\b/i],
    ["Historia de Cuba", /\b(mamb[ií]|jos[eé] mart[ií]|revoluci[oó]n|moncada|guerra de los diez a[nñ]os|independencia de cuba|baragu[aá]|colonia espa[nñ]ola|guerras mambisas)\b/i],
    ["Historia", /\b(feudalismo|edad media|revoluci[oó]n francesa|primera guerra|segunda guerra|imperio romano|grecia antigua|antigüedad)\b/i],
    ["Geografía", /\b(relieve|llanura|cordillera|meseta|clima|hidrograf[ií]a|latitud|longitud|continente|oc[eé]ano|atm[oó]sfera|r[ií]o|paisaje natural)\b/i],
    ["Español-Literatura", /\b(oraci[oó]n gramatical|sujeto y predicado|sustantivo|adjetivo|verbo|comprensi[oó]n lectora|sin[oó]nimo|ant[oó]nimo|met[aá]fora|cuento|poes[ií]a|literatur|párrafo)\b/i],
    ["Inglés", /\b(present simple|past continuous|vocabulary|reading comprehension|listening|adjectives|pronouns|sentences in english)\b/i],
    ["Informática", /\b(algoritmo|hardware|software|sistema operativo|computadora|procesador de texto|hoja de c[aá]lculo|navegador web|internet)\b/i],
  ];

  const ASIGNATURAS_REGEX = "QUÍMICA|GEOGRAFÍA|FÍSICA|BIOLOGÍA|MATEMÁTICA|HISTORIA|ESPAÑOL|INGLÉS|CIENCIAS|EDUCACIÓN|INFORMÁTICA";

  /** ¿Esta línea marca el comienzo de una nueva clase? */
  function iniciaClase(linea) {
    const t = limpiarEmoji(linea).trim();
    if (!t) return false;

    // 1. Separador manual explícito: "=== CLASE ==="
    if (/^===\s*CLASE\s*===$/i.test(t)) return true;

    // 2. Patrones de clase o sesión numerada (muy común en Internet y libros):
    // "Clase 1:", "Clase #4", "Sesión 2", "Lección 1", "Secuencia 3"
    if (/^(?:CLASE|SESI[ÓO]N|LECCI[ÓO]N|SECUENCIA(?:\s+DID[ÁA]CTICA)?|BLOQUE)\s*(?:N[º°o]?\.?|#)?\s*\d+/i.test(t)) return true;

    // 3. Materia seguida de grado: "Química 8.º grado", "FÍSICA – 9.º GRADO", "Biología 8vo"
    const patMateriaGrado = new RegExp(`^(${ASIGNATURAS_REGEX})\\s*[-–—:]?\\s*\\d+\\.?\\s*(?:º|vo|mo|ro|no)?\\s*(grado|GRADO)?`, "i");
    if (patMateriaGrado.test(t)) return true;

    // 4. Cualquier asignatura/texto de título seguido explícitamente de grado: "Educación Cívica - 9.º grado"
    if (/\b\d+\.?\s*(?:º|vo|mo|ro|no)?\s*(?:grado|GRADO)\b/i.test(t) &&
        /^(?:[A-ZÁÉÍÓÚÑa-záéíóúñ\s–—-]{3,35})\s*[-–—:]?\s*\d+/i.test(t)) {
      return true;
    }

    // 5. "PLAN DE CLASE..." / "PLANIFICACIÓN DE CLASE..."
    if (/^PLAN(?:IFICACIÓN)?\s+(?:DE\s+)?(?:LA\s+)?CLASE\b/i.test(t)) return true;

    // 6. "Clase de [Asignatura / sistematización / repaso]"
    if (/^Clase\s+de\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]/i.test(t)) return true;

    // 7. Trabajos prácticos / Seminarios / Clases prácticas
    if (/^(?:TRABAJO\s+PRÁCTICO|SEMINARIO|CLASE\s+PRÁCTICA)\b/i.test(t)) return true;

    return false;
  }

  // Campos de metadatos que aparecen al inicio de las planificaciones.
  const CAMPOS_META = [
    "Asignatura", "Grado", "Unidad", "Tema", "Subtema", "Tipo de clase",
    "Tiempo", "Método", "Procedimientos", "Forma de organización",
    "Medios de enseñanza", "Medios", "Fecha", "Nivel", "Lugar", "Objetivo",
  ];

  function extraerMeta(lineas) {
    const meta = {};
    for (let i = 0; i < lineas.length; i++) {
      const raw = lineas[i].trim();
      if (!raw) continue;
      const m = raw.match(/^([A-ZÁÉÍÓÚÑ][^\s:]*[^\s:]*|Asignatura|Grado|Unidad|Tema|Tipo de clase|Forma de organización|Medios de enseñanza|Tiempo|Método|Procedimientos|Objetivo)\s*:\s*(.*)$/i);
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
    // 1. Detección directa por nombre de materia
    for (const [nombre, reg] of ASIGNATURAS_LISTA) {
      if (reg.test(textoCompleto)) return nombre;
    }
    // 2. Búsqueda explícita de "Asignatura: [Nombre]"
    const asigMatch = textoCompleto.match(/Asignatura\s*:\s*([^\r\n]+)/i);
    if (asigMatch && asigMatch[1].trim()) {
      return limpiarEmoji(asigMatch[1].trim()).slice(0, 40);
    }
    // 3. Inferencia por contenido temático (palabras clave del texto copiado de internet)
    for (const [nombre, reg] of INFERENCIA_TEMATICA) {
      if (reg.test(textoCompleto)) return nombre;
    }
    return "Clase";
  }

  function detectarGrado(textoCompleto) {
    const m = textoCompleto.match(/(\d+)[.,]?\s*(?:º|vo|mo|ro|no)?\s*(grado|GRADO)?/);
    if (m) return m[1] + ".º";
    const g = textoCompleto.match(/[Gg]rado:\s*(\d+)/);
    if (g) return g[1] + ".º";
    return "";
  }

  function extraerTema(lineas, meta) {
    if (meta.Tema && meta.Tema.trim()) return meta.Tema.trim();
    for (const l of lineas) {
      const t = limpiarEmoji(l).trim();
      if (!t || /^===\s*CLASE\s*===/i.test(t)) continue;
      if (/^(?:clase|sesi[oó]n|lecci[oó]n)\s*(?:#|n[º°o]?\.?)\s*\d+$/i.test(t)) continue;
      const m = t.match(/^(?:Tema|Título|Contenido|Asunto)\s*:\s*(.+)$/i);
      if (m && m[1].trim()) return m[1].trim();
      const s = t.match(/^(?:Sesión|Lección|Clase)\s*\d+\s*[-–—:]\s*(.+)$/i);
      if (s && s[1].trim()) return s[1].trim();
      // Si la línea tiene aspecto de título corto y no es una sección técnica
      if (t.length >= 3 && t.length <= 85 && !/^(objetivo|inicio|desarrollo|cierre|actividades|evaluaci[oó]n|recursos):?$/i.test(t)) {
        const clean = t.replace(new RegExp(`^(?:${ASIGNATURAS_REGEX})\\s*[-–—:]?\\s*(?:\\d+[.,]?\\s*(?:º|vo|mo|ro|no)?\\s*(?:grado)?)?\\s*[-–—:]?\\s*`, "i"), "");
        if (clean.length >= 3) return clean;
      }
    }
    return "";
  }

  function limpiarNombreArchivo(texto) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quita tildes para máxima compatibilidad
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60);
  }

  function nombreArchivo(asignatura, grado, tema) {
    const partes = [asignatura, grado, tema].filter(Boolean);
    const base = limpiarNombreArchivo(partes.join("_"));
    return (base || "clase") + ".docx";
  }

  /**
   * Divide el texto pegado en clases y completa detalles faltantes.
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
      const tema = extraerTema(block, meta);

      // Título presentable
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
      if (!title) {
        title = tema || (asignatura !== "Clase" ? asignatura : "Clase " + (idx + 1));
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

  global.Parser = { parseClases, iniciaClase, detectarAsignatura, nombreArchivo };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.Parser;
  }
})(typeof window !== "undefined" ? window : global);
