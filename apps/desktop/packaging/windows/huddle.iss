#ifndef MyAppVersion
  #error MyAppVersion is required
#endif
#ifndef MyArch
  #error MyArch is required
#endif
#ifndef MyTarget
  #error MyTarget is required
#endif
#ifndef MyRepoRoot
  #error MyRepoRoot is required
#endif

[Setup]
AppId={{BAB040FE-291E-4A8F-8127-E4291BAFC77F}
AppName=Huddle
AppVersion={#MyAppVersion}
AppPublisher=Huddle
AppPublisherURL=https://github.com/Oluwasetemi/huddle
AppSupportURL=https://github.com/Oluwasetemi/huddle/issues
DefaultDirName={autopf}\Huddle
DefaultGroupName=Huddle
DisableProgramGroupPage=yes
OutputDir={#MyRepoRoot}\target\dist
OutputBaseFilename=Huddle-{#MyOriginalVersion}-windows-{#MyArch}-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=Huddle

[Files]
Source: "{#MyRepoRoot}\target\{#MyTarget}\release\huddle-desktop.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Huddle"; Filename: "{app}\huddle-desktop.exe"
Name: "{autodesktop}\Huddle"; Filename: "{app}\huddle-desktop.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Run]
Filename: "{app}\huddle-desktop.exe"; Description: "Launch Huddle"; Flags: nowait postinstall skipifsilent
