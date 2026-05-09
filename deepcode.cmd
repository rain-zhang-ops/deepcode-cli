@echo off
REM Deepcode CLI wrapper
REM This batch script runs the Node.js CLI

setlocal enabledelayedexpansion

REM Get the directory of this script
set SCRIPT_DIR=%~dp0

REM Run the CLI with Node.js
node "%SCRIPT_DIR%dist\cli.js" %*

REM Exit with the same code as node
exit /b %ERRORLEVEL%
