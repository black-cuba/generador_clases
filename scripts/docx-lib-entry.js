/**
 * docx-lib-entry.js - Punto de entrada para esbuild.
 * Expone "docx" y "file-saver" como una variable global: window.DocxLib
 */
import * as docx from "docx";
import * as fileSaver from "file-saver";

window.DocxLib = { docx, fileSaver };
window.DocxLib.docx = docx;
window.DocxLib.fileSaver = fileSaver;