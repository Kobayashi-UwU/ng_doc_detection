import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { DocumentScannerComponent } from './document-scanner/document-scanner.component';

@NgModule({
  declarations: [
    AppComponent, // Main application component
    DocumentScannerComponent, // Your scanner component
  ],
  imports: [
    BrowserModule, // Basic browser module for the app to run in browsers
    FormsModule, // Required for two-way binding
  ],
  providers: [],
  bootstrap: [AppComponent], // Specifies the root component to bootstrap
})
export class AppModule {}
