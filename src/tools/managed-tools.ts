import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as https from "https";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type ManagedToolName = "rg" | "jq";

type ManagedToolDownload = {
  url: string;
  archive: "zip" | "file";
  executableName: string;
};

const TOOL_DOWNLOADS: Record<ManagedToolName, Partial<Record<NodeJS.Platform, ManagedToolDownload>>> = {
  rg: {
    win32: {
      url: getRipgrepWindowsUrl(),
      archive: "zip",
      executableName: "rg.exe"
    }
  },
  jq: {
    win32: {
      url: getJqWindowsUrl(),
      archive: "file",
      executableName: "jq.exe"
    }
  }
};

let ensurePromise: Promise<void> | null = null;

export function getManagedToolsRoot(homeDir = os.homedir()): string {
  return path.join(homeDir, ".deepcode", "tools");
}

export function getManagedToolsBinDir(homeDir = os.homedir()): string {
  return path.join(getManagedToolsRoot(homeDir), "bin");
}

export function getManagedToolExecutablePath(
  tool: ManagedToolName,
  platform: NodeJS.Platform = process.platform,
  homeDir = os.homedir()
): string | null {
  const download = TOOL_DOWNLOADS[tool][platform];
  if (!download) {
    return null;
  }
  return path.join(getManagedToolsBinDir(homeDir), download.executableName);
}

export function isManagedToolAvailable(tool: ManagedToolName): boolean {
  const executablePath = getManagedToolExecutablePath(tool);
  return Boolean(executablePath && fs.existsSync(executablePath));
}

export function getRecommendedCliToolsStatus(): Record<ManagedToolName, boolean> {
  return {
    rg: isManagedToolAvailable("rg"),
    jq: isManagedToolAvailable("jq")
  };
}

export function prependManagedToolsToPath(
  currentPath: string | undefined,
  homeDir = os.homedir()
): string {
  const managedBin = getManagedToolsBinDir(homeDir);
  if (!currentPath) {
    return managedBin;
  }

  const entries = currentPath.split(path.delimiter).filter(Boolean);
  const normalizedManagedBin = path.resolve(managedBin).toLowerCase();
  const alreadyPresent = entries.some((entry) => path.resolve(entry).toLowerCase() === normalizedManagedBin);
  return alreadyPresent ? currentPath : `${managedBin}${path.delimiter}${currentPath}`;
}

export async function ensureRecommendedCliTools(): Promise<void> {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = ensureRecommendedCliToolsOnce().catch((error) => {
    ensurePromise = null;
    throw error;
  });
  return ensurePromise;
}

async function ensureRecommendedCliToolsOnce(): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  await fs.promises.mkdir(getManagedToolsBinDir(), { recursive: true });
  await ensureManagedTool("rg");
  await ensureManagedTool("jq");
}

async function ensureManagedTool(tool: ManagedToolName): Promise<void> {
  if (isManagedToolAvailable(tool)) {
    return;
  }

  const download = TOOL_DOWNLOADS[tool][process.platform];
  const executablePath = getManagedToolExecutablePath(tool);
  if (!download || !executablePath) {
    return;
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `deepcode-${tool}-`));
  try {
    if (download.archive === "file") {
      await downloadFile(download.url, executablePath);
      return;
    }

    const archivePath = path.join(tmpDir, `${tool}.zip`);
    const extractDir = path.join(tmpDir, "extract");
    await downloadFile(download.url, archivePath);
    await extractZip(archivePath, extractDir);
    const extractedExecutable = await findFileRecursive(extractDir, download.executableName);
    if (!extractedExecutable) {
      throw new Error(`Could not locate ${download.executableName} after extracting ${tool}.`);
    }
    await fs.promises.copyFile(extractedExecutable, executablePath);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function downloadFile(url: string, destination: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "deepcode-cli"
        }
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          response.resume();
          downloadFile(response.headers.location, destination).then(resolve, reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Download failed with status ${statusCode} for ${url}`));
          return;
        }

        const file = fs.createWriteStream(destination);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (error) => {
          file.close();
          reject(error);
        });
      }
    );

    request.on("error", reject);
  });
}

async function extractZip(archivePath: string, destination: string): Promise<void> {
  await fs.promises.mkdir(destination, { recursive: true });
  await execFileAsync(
    "powershell",
    [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Expand-Archive -LiteralPath '${escapePowerShell(archivePath)}' -DestinationPath '${escapePowerShell(destination)}' -Force`
    ],
    { windowsHide: true }
  );
}

async function findFileRecursive(rootDir: string, fileName: string): Promise<string | null> {
  const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const nested = await findFileRecursive(fullPath, fileName);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

function getRipgrepWindowsUrl(): string {
  if (process.arch === "arm64") {
    return "https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-aarch64-pc-windows-msvc.zip";
  }
  return "https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-x86_64-pc-windows-msvc.zip";
}

function getJqWindowsUrl(): string {
  if (process.arch === "arm64") {
    return "https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-windows-arm64.exe";
  }
  return "https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-windows-amd64.exe";
}
