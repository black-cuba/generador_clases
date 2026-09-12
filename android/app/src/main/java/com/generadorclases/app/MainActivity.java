package com.generadorclases.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Debe registrarse ANTES de super.onCreate: el Bridge se construye ahí
        // y exporta el JS de los plugins al WebView en ese momento.
        registerPlugin(SaveToDownloadsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}