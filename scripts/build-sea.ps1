$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
	$PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Get-NodeMajorVersion {
	$raw = (& node --version 2>$null)
	if (-not $raw) { return $null }
	if ($raw -match "^v(\d+)\.") {
		return [int]$Matches[1]
	}
	return $null
}

function Fail-WithDiagnostics {
	param(
		[string]$Step,
		[int]$ExitCode,
		[string[]]$OutputLines = @()
	)

	Write-Host ""
	Write-Host "Build failed at step: $Step" -ForegroundColor Red
	Write-Host "Exit code: $ExitCode" -ForegroundColor Red

	if ($OutputLines.Count -gt 0) {
		Write-Host ""
		Write-Host "--- command output (tail) ---" -ForegroundColor DarkGray
		$OutputLines | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
	}

	$allText = ($OutputLines -join "`n")
	Write-Host ""
	Write-Host "Diagnostics:" -ForegroundColor Yellow

	if ($Step -eq "Inject blob into executable" -and $allText -match "Could not find the sentinel") {
		Write-Host "- Sentinel not found: ensure postject command includes --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2." -ForegroundColor Yellow
	}

	if ($Step -eq "Inject blob into executable" -and $allText -match "signature seems corrupted") {
		Write-Host "- Signature warning detected: this is common on copied node.exe and may still be okay if injection completes." -ForegroundColor Yellow
	}

	if ($Step -eq "Verify executable" -and ($allText -match "Welcome to Node\.js" -or $allText -match 'Type "\.help"')) {
		Write-Host "- Executable entered Node REPL: SEA injection likely failed or was skipped." -ForegroundColor Yellow
		Write-Host "- Re-run: npm run build:exe" -ForegroundColor Yellow
	}

	Write-Host "- Check Node version with: node --version (SEA exe build recommends Node v25+)." -ForegroundColor Yellow
	Write-Host "- Confirm files exist: dist/sea-entry.cjs, dist/sea-prep.blob, dist/deepcode.exe." -ForegroundColor Yellow
	exit $ExitCode
}

$nodeMajor = Get-NodeMajorVersion
if ($null -eq $nodeMajor) {
	Write-Host "Warning: unable to detect Node.js version." -ForegroundColor Yellow
} elseif ($nodeMajor -lt 18) {
	Write-Host "Node.js $nodeMajor detected, but this project requires Node.js >= 18.17.0." -ForegroundColor Red
	exit 1
} elseif ($nodeMajor -lt 25) {
	Write-Host "Warning: Node.js $nodeMajor detected. SEA exe build is more reliable on Node.js v25+." -ForegroundColor Yellow
}

Write-Host "[1/6] TypeScript typecheck..." -ForegroundColor Cyan
& npm run typecheck
if ($LASTEXITCODE -ne 0) { Fail-WithDiagnostics -Step "TypeScript typecheck" -ExitCode $LASTEXITCODE }

Write-Host "[2/6] Bundle cli..." -ForegroundColor Cyan
& npm run bundle
if ($LASTEXITCODE -ne 0) { Fail-WithDiagnostics -Step "Bundle cli" -ExitCode $LASTEXITCODE }

Write-Host "[3/6] Generate SEA entry..." -ForegroundColor Cyan
& node scripts/gen-sea-entry.mjs
if ($LASTEXITCODE -ne 0) { Fail-WithDiagnostics -Step "Generate SEA entry" -ExitCode $LASTEXITCODE }

Write-Host "[4/6] Generate SEA blob..." -ForegroundColor Cyan
& node --experimental-sea-config sea-config.json --experimental-require-module
if ($LASTEXITCODE -ne 0) { Fail-WithDiagnostics -Step "Generate SEA blob" -ExitCode $LASTEXITCODE }

Write-Host "[5/6] Inject blob into executable..." -ForegroundColor Cyan
$nodeExe = (Get-Command node).Source
Get-Process -Name "deepcode" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$targetExe = Resolve-Path "dist/deepcode.exe" -ErrorAction SilentlyContinue
$targetExePath = if ($targetExe) { $targetExe.Path } else { $null }
if ($targetExePath) {
	Get-CimInstance Win32_Process |
		Where-Object {
			$_.ExecutablePath -eq $targetExePath -or
			($_.CommandLine -like "*postject*deepcode.exe*") -or
			($_.CommandLine -like "*npx*postject*deepcode.exe*")
		} |
		ForEach-Object {
			Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
		}
}
Copy-Item $nodeExe "dist/deepcode.exe" -Force

$prevErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$postjectOutput = @(& npx postject dist/deepcode.exe NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite 2>&1 | ForEach-Object { "$_" })
$postjectExitCode = $LASTEXITCODE
$ErrorActionPreference = $prevErrorActionPreference
$postjectOutput | ForEach-Object { Write-Host $_ }
if ($postjectExitCode -ne 0) {
	Fail-WithDiagnostics -Step "Inject blob into executable" -ExitCode $postjectExitCode -OutputLines $postjectOutput
}

Write-Host "[6/6] Verify executable..." -ForegroundColor Cyan
$verifyOutput = @(& .\dist\deepcode.exe --version 2>&1 | ForEach-Object { "$_" })
$verifyOutput | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
	Fail-WithDiagnostics -Step "Verify executable" -ExitCode $LASTEXITCODE -OutputLines $verifyOutput
}

Write-Host "SEA build completed." -ForegroundColor Green
