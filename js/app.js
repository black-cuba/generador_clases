/**
 * app.js - Lógica principal de GeneradorClases.
 * Con Capacitor se guarda directo en Descargas o se envía por WhatsApp.
 * Si WhatsApp no está instalado, se guarda directamente en el celular sin mostrar mensaje.
 * No utiliza compartir nativo.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

const SaveToDownloads = registerPlugin("SaveToDownloads");

function esNativo() {
  return !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
}

function toast(msg, tipo) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show " + (tipo || "");
  setTimeout(() => { el.className = "toast"; }, 3000);
}

function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// ------------------------------------------------------------
// Acciones de WhatsApp y guardado en Descargas
// ------------------------------------------------------------
async function enviarAWhatsApp(clase) {
  const { blob } = await window.DocxGen.generarDocx(clase);

  if (esNativo()) {
    const b64 = await blobABase64(blob);
    const escrito = await Filesystem.writeFile({
      path: "clases/" + clase.nombre,
      data: b64,
      directory: Directory.Cache,
      recursive: true,
    });
    const filePath = escrito.uri.replace(/^file:\/\//, "");
    try {
      await SaveToDownloads.shareToWhatsApp({ path: filePath, fileName: clase.nombre });
      return;
    } catch (e) {
      // Si no está WhatsApp, descarga en el celular directo sin mostrar mensaje
      await SaveToDownloads.save({ fileName: clase.nombre, base64: b64 });
      return;
    }
  }

  // Navegador web (PC / pruebas)
  const saveAsFn = window.DocxLib?.fileSaver?.saveAs;
  if (saveAsFn) {
    saveAsFn(blob, clase.nombre);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = clase.nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

async function guardarDocx(clase) {
  const { blob, nombre } = await window.DocxGen.generarDocx(clase);

  if (esNativo()) {
    const b64 = await blobABase64(blob);
    const res = await SaveToDownloads.save({ fileName: nombre, base64: b64 });
    return { ...res, nombre };
  }

  const saveAsFn = window.DocxLib?.fileSaver?.saveAs;
  if (saveAsFn) {
    saveAsFn(blob, nombre);
    return { nombre };
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { nombre };
}

async function guardarTodas(clases) {
  let count = 0;
  for (const c of clases) {
    await guardarDocx(c);
    count++;
    if (!esNativo()) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return count;
}

// ------------------------------------------------------------
// Renderizado de la lista de clases detectadas
// ------------------------------------------------------------
function renderClases(clases) {
  const lista = document.getElementById("listaClases");
  lista.innerHTML = "";

  clases.forEach((c) => {
    const item = document.createElement("div");
    item.className = "clase-item";

    const num = document.createElement("div");
    num.className = "clase-num";
    num.textContent = "Clase " + c.id;

    const tit = document.createElement("div");
    tit.className = "clase-titulo";
    tit.textContent = c.title || "Clase " + c.id;

    const meta = document.createElement("div");
    meta.className = "clase-meta";
    meta.textContent =
      [c.asignatura, c.grado ? c.grado + " grado" : null, c.numerolineas + " líneas"]
        .filter((x) => x)
        .join(" · ");

    const archivo = document.createElement("div");
    archivo.className = "clase-archivo";
    archivo.textContent = "📄 " + c.nombre;

    const acciones = document.createElement("div");
    acciones.className = "clase-acciones";

    const btnWhatsApp = document.createElement("button");
    btnWhatsApp.className = "btn btn-small btn-share";
    btnWhatsApp.innerHTML = "💬 WhatsApp";
    btnWhatsApp.onclick = () =>
      enviarAWhatsApp(c)
        .catch((e) => toast("Error: " + e.message, "error"));

    const btnDesc = document.createElement("button");
    btnDesc.className = "btn btn-small btn-download";
    btnDesc.innerHTML = esNativo() ? "💾 Guardar" : "⬇️ Descargar";
    btnDesc.onclick = () =>
      guardarDocx(c)
        .then(() => toast(c.nombre + " guardado en Descargas ✓", "success"))
        .catch((e) => toast("Error: " + e.message, "error"));

    acciones.appendChild(btnWhatsApp);
    acciones.appendChild(btnDesc);

    item.appendChild(num);
    item.appendChild(tit);
    item.appendChild(meta);
    item.appendChild(acciones);
    lista.appendChild(item);
  });
}

// ------------------------------------------------------------
// Eventos
// ------------------------------------------------------------
function main() {
  const btnGenerar = document.getElementById("btnGenerar");
  const btnLimpiar = document.getElementById("btnLimpiar");
  const btnVolver = document.getElementById("btnVolver");
  const btnGuardarTodas = document.getElementById("btnGuardarTodas");
  const textarea = document.getElementById("textareaTexto");
  const pasoEntrada = document.getElementById("pasoEntrada");
  const pasoResultado = document.getElementById("pasoResultado");
  const badge = document.getElementById("badgeConteo");

  let clasesDetectadas = [];

  btnGenerar.addEventListener("click", async () => {
    const texto = textarea.value;
    if (!texto.trim()) {
      toast("Pega primero el texto de las clases", "error");
      return;
    }

    btnGenerar.disabled = true;
    btnGenerar.innerHTML = '<span class="spinner"></span> Analizando...';
    toast("Analizando texto…");

    await new Promise((r) => setTimeout(r, 50));

    clasesDetectadas = window.Parser.parseClases(texto);

    btnGenerar.disabled = false;
    btnGenerar.innerHTML = "⚡ Generar clases en Word";

    if (!clasesDetectadas.length) {
      toast("No se detectaron clases. Revisa el texto o usa === CLASE ===", "error");
      return;
    }

    badge.textContent = clasesDetectadas.length + " encontradas";
    renderClases(clasesDetectadas);

    pasoEntrada.style.display = "none";
    pasoResultado.style.display = "block";
    toast("✓ " + clasesDetectadas.length + " clase(s) detectada(s)");
  });

  if (btnGuardarTodas) {
    btnGuardarTodas.addEventListener("click", () => {
      if (!clasesDetectadas.length) return;
      btnGuardarTodas.disabled = true;
      btnGuardarTodas.innerHTML = '<span class="spinner"></span> Guardando...';
      guardarTodas(clasesDetectadas)
        .then(() => toast("Guardadas " + clasesDetectadas.length + " clases en Descargas ✓", "success"))
        .catch((e) => toast("Error: " + e.message, "error"))
        .finally(() => {
          btnGuardarTodas.disabled = false;
          btnGuardarTodas.innerHTML = "💾 Guardar todas en Descargas";
        });
    });
  }

  btnLimpiar.addEventListener("click", () => {
    textarea.value = "";
    textarea.focus();
  });

  btnVolver.addEventListener("click", () => {
    pasoResultado.style.display = "none";
    pasoEntrada.style.display = "block";
  });
}

document.addEventListener("DOMContentLoaded", main);
