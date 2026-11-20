package com.researchdirector.shell;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugin: registered explicitly (not packaged via npm).
        registerPlugin(SecureProviderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
