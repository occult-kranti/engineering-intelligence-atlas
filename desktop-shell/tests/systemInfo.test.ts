import { describe, expect, it } from 'vitest';
import type { ExecFileFn } from '../src/main/systemInfo';
import { getSystemInfo, parseNvidiaSmiCsv, queryGpus } from '../src/main/systemInfo';
import { checkModelRequirements } from '../src/main/catalog';
import type { CatalogModel, SystemInfo } from '../src/shared/contract';

const nvidiaSmiOk: ExecFileFn = async (file, args) => {
  expect(file).toBe('nvidia-smi');
  expect(args).toEqual([
    '--query-gpu=name,memory.total,memory.free',
    '--format=csv,noheader,nounits',
  ]);
  return { stdout: 'NVIDIA RTX 4090, 24564, 23000\nNVIDIA RTX 3060, 12288, 11000\n', stderr: '' };
};

const nvidiaSmiMissing: ExecFileFn = async () => {
  throw new Error('spawn nvidia-smi ENOENT');
};

function makeModel(overrides: Partial<CatalogModel> = {}): CatalogModel {
  return {
    id: 'm',
    family: 'f',
    task: 'text-generation',
    repoId: 'org/model',
    revision: 'a'.repeat(40),
    format: 'GGUF',
    quantization: null,
    sizeBytes: 1000,
    files: [{ path: 'm.bin', sizeBytes: 1000, sha256: null }],
    minRamBytes: 500,
    minVramBytes: null,
    license: 'mit',
    sourceUrl: 'https://huggingface.co/org/model',
    runtime: 'llama.cpp',
    remoteCodeRequired: false,
    availability: 'available',
    ...overrides,
  };
}

function makeSys(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    cpuModel: 'Test CPU',
    logicalCores: 8,
    totalRamBytes: 32_000_000_000,
    freeRamBytes: 16_000_000_000,
    os: { platform: 'linux', release: '6.0', arch: 'x64' },
    disk: { totalBytes: 1_000_000_000_000, freeBytes: 500_000_000_000, path: '/tmp' },
    gpus: [],
    notes: [],
    ...overrides,
  };
}

describe('parseNvidiaSmiCsv', () => {
  it('parses name and VRAM in MiB to bytes', () => {
    const gpus = parseNvidiaSmiCsv('NVIDIA RTX 4090, 24564, 23000\n');
    expect(gpus).toHaveLength(1);
    expect(gpus[0]?.name).toBe('NVIDIA RTX 4090');
    expect(gpus[0]?.vramTotalBytes).toBe(24564 * 1024 * 1024);
    expect(gpus[0]?.vramFreeBytes).toBe(23000 * 1024 * 1024);
    expect(gpus[0]?.source).toBe('nvidia-smi');
  });

  it('keeps unparseable VRAM as null (honest unknown)', () => {
    const gpus = parseNvidiaSmiCsv('Some GPU, [N/A], [N/A]\n');
    expect(gpus[0]?.vramTotalBytes).toBeNull();
    expect(gpus[0]?.vramFreeBytes).toBeNull();
  });

  it('handles empty output', () => {
    expect(parseNvidiaSmiCsv('')).toEqual([]);
  });
});

describe('queryGpus', () => {
  it('returns devices when nvidia-smi works', async () => {
    const gpus = await queryGpus(nvidiaSmiOk);
    expect(gpus).toHaveLength(2);
  });

  it('returns empty list when nvidia-smi is missing', async () => {
    expect(await queryGpus(nvidiaSmiMissing)).toEqual([]);
  });
});

describe('getSystemInfo', () => {
  it('notes unknown VRAM when no GPU telemetry is available', async () => {
    const info = await getSystemInfo('/tmp', {
      execFileFn: nvidiaSmiMissing,
      disk: { totalBytes: 100, freeBytes: 50 },
    });
    expect(info.gpus).toEqual([]);
    expect(info.notes.join(' ')).toMatch(/VRAM is unknown/);
  });

  it('notes unmeasurable disk', async () => {
    const info = await getSystemInfo('/tmp', {
      execFileFn: nvidiaSmiOk,
      disk: { totalBytes: null, freeBytes: null },
    });
    expect(info.notes.join(' ')).toMatch(/Disk space.*could not be measured/);
  });
});

describe('checkModelRequirements', () => {
  it('passes when all declared requirements are met', () => {
    const report = checkModelRequirements(makeModel(), makeSys());
    expect(report.checks.ram.status).toBe('pass');
    expect(report.checks.disk.status).toBe('pass');
    expect(report.canDownload).toBe(true);
  });

  it('fails on insufficient disk and blocks download', () => {
    const report = checkModelRequirements(
      makeModel(),
      makeSys({ disk: { totalBytes: 100, freeBytes: 10, path: '/tmp' } }),
    );
    expect(report.checks.disk.status).toBe('fail');
    expect(report.canDownload).toBe(false);
    expect(report.summary).toMatch(/Not eligible/);
  });

  it('fails on insufficient free RAM', () => {
    const report = checkModelRequirements(makeModel(), makeSys({ freeRamBytes: 100 }));
    expect(report.checks.ram.status).toBe('fail');
    expect(report.canDownload).toBe(false);
  });

  it('reports VRAM as unknown when not declared (never passes silently)', () => {
    const report = checkModelRequirements(makeModel({ minVramBytes: null }), makeSys());
    expect(report.checks.vram.status).toBe('unknown');
    expect(report.summary).toMatch(/unknown/i);
  });

  it('reports VRAM unknown when GPUs have no measurement', () => {
    const report = checkModelRequirements(makeModel({ minVramBytes: 8_000_000_000 }), makeSys());
    expect(report.checks.vram.status).toBe('unknown');
    expect(report.checks.vram.availableBytes).toBeNull();
    expect(report.canDownload).toBe(true); // unknowns do not block, but are surfaced
  });

  it('checks against the best measured GPU when VRAM declared', () => {
    const sys = makeSys({
      gpus: [
        { name: 'A', vramTotalBytes: 4_000_000_000, vramFreeBytes: null, source: 'nvidia-smi' },
        { name: 'B', vramTotalBytes: 24_000_000_000, vramFreeBytes: null, source: 'nvidia-smi' },
      ],
    });
    const report = checkModelRequirements(makeModel({ minVramBytes: 8_000_000_000 }), sys);
    expect(report.checks.vram.status).toBe('pass');
    expect(report.checks.vram.availableBytes).toBe(24_000_000_000);
  });

  it('reports RAM unknown when the model declares no floor', () => {
    const report = checkModelRequirements(makeModel({ minRamBytes: null }), makeSys());
    expect(report.checks.ram.status).toBe('unknown');
  });
});
