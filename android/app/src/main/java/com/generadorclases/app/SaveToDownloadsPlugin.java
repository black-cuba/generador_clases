package com.generadorclases.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Guarda un archivo .docx en la carpeta pública "Descargas" del dispositivo.
 * API 29+  -> MediaStore.Downloads (sin permisos, aparece en Descargas y Archivos).
 * API 23-28 -> Permiso runtime WRITE_EXTERNAL_STORAGE + carpeta pública Downloads.
 */
@CapacitorPlugin(
    name = "SaveToDownloads",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    })
public class SaveToDownloadsPlugin extends Plugin {

    private static final String MIME_DOCX =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64 = call.getString("base64");
        if (fileName == null || base64 == null || fileName.trim().isEmpty()) {
            call.reject("Los parámetros fileName y base64 son obligatorios");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveViaMediaStore(call, fileName, base64);
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        saveLegacy(call, fileName, base64);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64 = call.getString("base64");
        if (fileName == null || base64 == null) {
            call.reject("Los parámetros fileName y base64 son obligatorios");
            return;
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED) {
            saveLegacy(call, fileName, base64);
        } else {
            call.reject("Permiso de almacenamiento denegado");
        }
    }

    private void saveViaMediaStore(PluginCall call, String fileName, String base64) {
        try {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, MIME_DOCX);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("No se pudo crear el archivo en Descargas");
                return;
            }

            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            OutputStream os = resolver.openOutputStream(uri);
            os.write(bytes);
            os.close();

            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            ret.put("path", Environment.DIRECTORY_DOWNLOADS + "/" + fileName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al guardar: " + e.getMessage(), e);
        }
    }

    private void saveLegacy(PluginCall call, String fileName, String base64) {
        try {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("No se pudo crear la carpeta Descargas");
                return;
            }
            File out = new File(dir, fileName);
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            FileOutputStream fos = new FileOutputStream(out);
            fos.write(bytes);
            fos.close();

            JSObject ret = new JSObject();
            ret.put("uri", Uri.fromFile(out).toString());
            ret.put("path", out.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al guardar: " + e.getMessage(), e);
        }
    }
}