# Resident Training v1.0.76

Frontend-only usability update to the normal E-logbook reviewer pickers.

## Changes
- Assessor picker now behaves like the senior-resident autocomplete: type letters and matching assessor names appear immediately underneath; click a name to select it.
- Assessor names are alphabetized by the actual name, ignoring leading titles such as `Dr.`, `Dr`, `Prof. Dr.`, `Prof Dr`, and `Prof.`.
- Senior-resident and assessor result-name typography is smaller and more compact.
- Conference assessor selection uses the same searchable picker.

## Install
No SQL is required if v1.0.75 SQL is already installed.
Replace `app.html`, `index.html`, `assets/app.js`, and `assets/style.css`, then hard-refresh.
