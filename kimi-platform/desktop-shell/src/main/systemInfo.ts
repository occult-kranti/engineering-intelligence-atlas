import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GpuInfo, SystemInfo } from '../shared/contract';

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: { timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

export const defaultExecFile: ExecFileFn = async (file, args, options) => {
  const run = promisify(execFile);
  const result = await run(file, args as string[], {
    timeout: options.timeout,
    windowsHide: true,
    // Never a shell: args are passed verbatim to the executable.
    shell: false,
  });
  return { stdout: result.stdout, stderr: result.stderr };
};

const MIB = 1024 * 1024;

/**
 * Parse `nvidia-smi --query-gpu=name,memory.total,memory.free
 * --format=csv,noheader,nounits` output. VRAM values arrive in MiB.
 */
export function parseNvidiaSmiCsv(stdout: string): GpuInfo[] {
  const gpus: GpuInfo[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(',').map((p) => p.trim());
    const name = parts[0];
    if (!name) continue;
    const totalMiB = parts[1] !== undefined ? Number(parts[1]) : NaN;
    const freeMiB = parts[2] !== undefined ? Number(parts[2]) : NaN;
    gpus.push({
      name,
      vramTotalBytes: Number.isFinite(totalMiB) ? Math.round(totalMiB * MIB) : null,
      vramFreeBytes: Number.isFinite(freeMiB) ? Math.round(freeMiB * MIB) : null,
      source: 'nvidia-smi',
    });
  }
  return gpus;
}

/**
 * Query GPU telemetry via nvidia-smi with fixed arguments. When the tool is
 * absent or fails, returns an empty list — VRAM is reported as unknown, never
 * inferred from a device name.
 */
export async function queryGpus(execFileFn: ExecFileFn = defaultExecFile): Promise<GpuInfo[]> {
  try {
    const { stdout } = await execFileFn(
      'nvidia-smi',
      ['--query-gpu=name,memory.total,memory.free', '--format=csv,noheader,nounits'],
      { timeout: 5000 },
    );
    return parseNvidiaSmiCsv(stdout);
  } catch {
    return [];
  }
}

export interface DiskSpace {
  totalBytes: number | null;
  freeBytes: number | null;
}

/** Total/free bytes of the filesystem containing `targetPath`. */
export function queryDiskSpace(targetPath: string): DiskSpace {
  try {
    const stats = fs.statfsSync(targetPath);
    return {
      totalBytes: Number(stats.bsize) * Number(stats.blocks),
      freeBytes: Number(stats.bsize) * Number(stats.bavail),
    };
  } catch {
    return { totalBytes: null, freeBytes: null };
  }
}

export interface SystemInfoDeps {
  execFileFn?: ExecFileFn;
  /** Overridable for tests. */
  cpuModel?: string;
  logicalCores?: number;
  totalRamBytes?: number;
  freeRamBytes?: number;
  disk?: DiskSpace;
}

/**
 * Collect local system information. All measurements are direct; anything we
 * cannot measure is reported as null/unknown with an explanatory note.
 */
export async function getSystemInfo(
  userDataPath: string,
  deps: SystemInfoDeps = {},
): Promise<SystemInfo> {
  const cpus = os.cpus();
  const gpus = await queryGpus(deps.execFileFn ?? defaultExecFile);
  const disk = deps.disk ?? queryDiskSpace(userDataPath);

  const notes: string[] = [];
  if (gpus.length === 0) {
    notes.push(
      'No GPU telemetry available (nvidia-smi not found or failed). VRAM is unknown; ' +
        'GPU suitability cannot be inferred from this device.',
    );
  }
  if (disk.freeBytes === null) {
    notes.push('Disk space for the data directory could not be measured.');
  }

  return {
    cpuModel: deps.cpuModel ?? cpus[0]?.model ?? 'Unknown CPU',
    logicalCores: deps.logicalCores ?? cpus.length,
    totalRamBytes: deps.totalRamBytes ?? os.totalmem(),
    freeRamBytes: deps.freeRamBytes ?? os.freemem(),
    os: { platform: os.platform(), release: os.release(), arch: os.arch() },
    disk: { ...disk, path: userDataPath },
    gpus,
    notes,
  };
}
