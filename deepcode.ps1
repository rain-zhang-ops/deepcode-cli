#!/usr/bin/env pwsh
# Deepcode CLI wrapper script
# This runs the compiled Node.js CLI until SEA binary compilation is fixed

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cliPath = Join-Path $scriptDir "dist/cli.js"
$nodeExe = (Get-Command node).Source

& $nodeExe $cliPath @args
exit $LASTEXITCODE
