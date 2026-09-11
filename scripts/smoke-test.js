// Smoke test node: verifica parser + chemformat + generacion docx
const fs = require("fs");
const path = require("path");

global.window = global;
// --- shims mínimos de DOM para que docx/file-saver carguen en Node ---
global.HTMLAnchorElement = function HTMLAnchorElement() {
  this.click = () => {};
  this.setAttribute = () => {};
};
global.navigator = { userAgent: "node" };
global.document = {
  createElement: () => new global.HTMLAnchorElement(),
  body: {},
  documentElement: {},
};
global.MouseEvent = function MouseEvent() {};
if (!global.URL) global.URL = require("url").URL;

// Cargar bundles
eval(fs.readFileSync(path.join(__dirname, "../www/js/docx-bundle.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../www/js/parser.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../www/js/chemformat.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../www/js/docxgenerator.js"), "utf8"));

const texto = `Planificación de clase – Química 8.º grado
Unidad: Introducción al estudio de la Química
Tema: El objeto de estudio de la Química
Tiempo: 45 minutos
Tipo de clase: Tratamiento de nuevo contenido
Método: Elaboración conjunta
Medios de enseñanza: Pizarra, libro de texto, imágenes.

Desarrollo de la clase
I. Introducción - 10 minutos
Motivación
El cubito de hielo H2O que se derrite.
Un clavo FeCl3 que se oxida.
Posibles respuestas:
- Son cambios.
- Las sustancias cambian.

II. Desarrollo - 25 minutos
¿Qué estudia la Química?
La Química estudia las sustancias: NaCl, CaCO3, Al2(SO4)3.
Iones: Na+, SO4 2-, Fe3+.

III. Conclusiones - 3 minutos
Preguntas de comprobación:
1. ¿Qué estudia la Química?
2. Menciona dos fenómenos químicos.

Tarea
Investiga cinco ejemplos y explica qué ocurre en cada caso.

QUÍMICA - 8.º GRADO
Unidad:
Capítulo I. La química
Tema:
Las sustancias puras
Tipo de clase:
Clase de introducción de nuevo contenido
I. Introducción - 10 minutos
Aseguramiento del nivel de partida
¿De qué están constituidos los cuerpos?
II. Desarrollo - 25 minutos
Concepto de sustancia pura
Una sustancia pura es aquella que no está mezclada.
Clasificación:
- Sustancias orgánicas
- Sustancias inorgánicas
Evaluación
1. Completa: a) Todos los cuerpos están constituidos por ____________.
Tarea para la casa
Busca en tu hogar cinco ejemplos.

PLAN DE CLASE DE QUÍMICA - 9.º GRADO
Unidad: Las sales
Tema: Nomenclatura y notación química de las sales ternarias
Objetivo
Que los estudiantes comprendan y apliquen las reglas fundamentales.
Desarrollo
Tabla de iones:
Ion\tNombre
NO3-\tnitrato
SO4 2-\tsulfato
Preguntas:
¿Qué son las sales ternarias?
Evaluación
1. Completa:
Tarea
Ejercicios de nomenclatura.`;

async function main() {
  const clases = window.Parser.parseClases(texto);
  console.log("Clases detectadas:", clases.length);
  clases.forEach((c) => {
    console.log(" -", c.id, "|", c.asignatura, "|", c.grado, "| tema:", c.tema, "| archivo:", c.nombre);
  });
  if (clases.length === 0) { process.exit(1); }

  // Generar el primer docx y verificar que no falle
  const uno = await window.DocxGen.generarDocx(clases[0]);
  console.log("Docx 1 generado:", uno.nombre, "-", uno.blob.size, "bytes");
  fs.writeFileSync(path.join(__dirname, "_prueba.docx"), Buffer.from(await uno.blob.arrayBuffer()));
  console.log("OK: primer docx escrito a _prueba.docx");
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });