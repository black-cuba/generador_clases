/**
 * app.js - Lógica principal de GeneradorClases.
 * Con Capacitor se guardan/comparten los .docx por la vía nativa;
 * en el navegador (prueba en PC) se descargan con file-saver.
 * NOTA: este archivo es el punto de entrada de esbuild (bundle), por eso
 * puede importar los plugins de Capacitor.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const SaveToDownloads = registerPlugin("SaveToDownloads");

const saveAs = window.DocxLib?.fileSaver?.saveAs;

function esNativo() {
  return !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
}

function toast(msg, tipo) {
  const el = document.getElementById("toast");
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
// Acciones de guardado/compartido
// ------------------------------------------------------------
async function compartirDocx(clase) {
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
    } catch (e) {
      if (e.message && e.message.indexOf("WHATSAPP_NOT_INSTALLED") !== -1) {
        toast("WhatsApp no está instalado", "error");
        return;
      }
      throw e;
    }
    return;
  } else if (saveAs) {
    saveAs(blob, clase.nombre);
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

  if (saveAs) { saveAs(blob, nombre); return { nombre }; }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { nombre };
}

async function compartirTodas(clases) {
  const generados = [];
  for (const c of clases) {
    const r = await window.DocxGen.generarDocx(c);
    generados.push({ ...r, id: c.id });
  }

  if (esNativo()) {
    const uris = [];
    for (const g of generados) {
      const b64 = await blobABase64(g.blob);
      const w = await Filesystem.writeFile({
        path: "clases/" + g.nombre,
        data: b64,
        directory: Directory.Cache,
        recursive: true,
      });
      uris.push(w.uri);
    }
    await Share.share({
      title: "Planificaciones de clase",
      files: uris,
    });
  } else {
    for (const g of generados) {
      if (saveAs) { saveAs(g.blob, g.nombre); }
      else {
        const url = URL.createObjectURL(g.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = g.nombre;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    }
  }
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
    tit.textContent = c.title;

    const meta = document.createElement("div");
    meta.className = "clase-meta";
    meta.textContent =
      [c.asignatura, c.grado, c.numerolineas + " líneas"]
        .filter((x) => x)
        .join(" · ");

    const acciones = document.createElement("div");
    acciones.className = "clase-acciones";

    const btnShare = document.createElement("button");
    btnShare.className = "btn btn-small btn-share";
    btnShare.innerHTML = "📤 Compartir";
    btnShare.onclick = () =>
      compartirDocx(c)
        .then(() => toast(c.nombre + " enviado ✓", "success"))
        .catch((e) => toast("Error: " + e.message, "error"));

    const btnDesc = document.createElement("button");
    btnDesc.className = "btn btn-small btn-download";
    btnDesc.innerHTML = esNativo() ? "💾 Guardar" : "⬇️ Descargar";
    btnDesc.onclick = () =>
      guardarDocx(c)
        .then(() => toast(c.nombre + " guardado ✓", "success"))
        .catch((e) => toast("Error: " + e.message, "error"));

    acciones.appendChild(btnShare);
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
  const btnTodas = document.getElementById("btnCompartirTodas");
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

    // Pequeña pausa para que el spinner se vea
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

  btnTodas.addEventListener("click", () => {
    if (!clasesDetectadas.length) return;
    btnTodas.disabled = true;
    btnTodas.innerHTML = '<span class="spinner"></span> Generando...';
    compartirTodas(clasesDetectadas)
      .then(() => toast("Se compartieron " + clasesDetectadas.length + " archivos ✓", "success"))
      .catch((e) => toast("Error: " + e.message, "error"))
      .finally(() => {
        btnTodas.disabled = false;
        btnTodas.innerHTML = "📤 Compartir todas";
      });
  });

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