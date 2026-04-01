@echo off
setlocal

set "TEMP=D:\temp"
set "TMP=D:\temp"

call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
if errorlevel 1 exit /b %errorlevel%

cd /d "%~dp0"
npm run tauri dev -- --no-watch

