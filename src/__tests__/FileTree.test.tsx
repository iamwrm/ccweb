import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileTree } from '../components/FileTree';

// Mock the api module
vi.mock('../lib/api', () => ({
  fetchFiles: vi.fn(),
  renameFile: vi.fn(),
}));

import { fetchFiles, renameFile } from '../lib/api';
const mockFetchFiles = vi.mocked(fetchFiles);
const mockRenameFile = vi.mocked(renameFile);
const mockWriteText = vi.fn();

beforeEach(() => {
  mockFetchFiles.mockReset();
  mockRenameFile.mockReset();
  mockWriteText.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockWriteText },
    configurable: true,
  });
});

const rootEntries = [
  { name: 'src', path: 'src', type: 'directory' as const },
  { name: 'README.md', path: 'README.md', type: 'file' as const, size: 100 },
  { name: 'package.json', path: 'package.json', type: 'file' as const, size: 500 },
];

const srcEntries = [
  { name: 'components', path: 'src/components', type: 'directory' as const },
  { name: 'main.ts', path: 'src/main.ts', type: 'file' as const, size: 50 },
];

describe('FileTree', () => {
  it('renders root entries on mount', async () => {
    mockFetchFiles.mockResolvedValueOnce(rootEntries);

    render(<FileTree onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    expect(mockFetchFiles).toHaveBeenCalledWith('.');
  });

  it('expands directory on click and fetches children', async () => {
    mockFetchFiles
      .mockResolvedValueOnce(rootEntries)
      .mockResolvedValueOnce(srcEntries);

    render(<FileTree onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('src'));

    await waitFor(() => {
      expect(screen.getByText('main.ts')).toBeInTheDocument();
      expect(screen.getByText('components')).toBeInTheDocument();
    });

    expect(mockFetchFiles).toHaveBeenCalledWith('src');
  });

  it('calls onFileSelect when file is clicked', async () => {
    mockFetchFiles.mockResolvedValueOnce(rootEntries);
    const onFileSelect = vi.fn();

    render(<FileTree onFileSelect={onFileSelect} />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('README.md'));
    expect(onFileSelect).toHaveBeenCalledWith('README.md', { pinned: false });
  });

  it('opens file as pinned on double click', async () => {
    mockFetchFiles.mockResolvedValueOnce(rootEntries);
    const onFileSelect = vi.fn();

    render(<FileTree onFileSelect={onFileSelect} />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByText('README.md'));
    expect(onFileSelect).toHaveBeenCalledWith('README.md', { pinned: true });
  });

  it('shows Explorer header', async () => {
    mockFetchFiles.mockResolvedValueOnce([]);
    render(<FileTree onFileSelect={vi.fn()} />);

    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    mockFetchFiles.mockRejectedValueOnce(new Error('Network error'));

    render(<FileTree onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('opens context menu on right click', async () => {
    mockFetchFiles.mockResolvedValueOnce(rootEntries);
    render(<FileTree onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByText('README.md'));
    expect(screen.getByRole('button', { name: 'Copy Path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Relative Path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
  });

  it('copies absolute path from context menu', async () => {
    mockFetchFiles.mockResolvedValueOnce(rootEntries);
    render(<FileTree onFileSelect={vi.fn()} root="/tmp/workspace" />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByText('README.md'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Path' }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('/tmp/workspace/README.md');
    });
  });

  it('copies relative path from context menu', async () => {
    mockFetchFiles.mockResolvedValueOnce(rootEntries);
    render(<FileTree onFileSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByText('README.md'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Relative Path' }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('README.md');
    });
  });

  it('renames entry from context menu and refreshes tree', async () => {
    mockFetchFiles
      .mockResolvedValueOnce(rootEntries)
      .mockResolvedValueOnce(rootEntries);
    mockRenameFile.mockResolvedValueOnce({ ok: true, path: 'README-renamed.md' });

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('README-renamed.md');

    render(<FileTree onFileSelect={vi.fn()} root="/tmp/workspace" />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByText('README.md'));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => {
      expect(mockRenameFile).toHaveBeenCalledWith('README.md', 'README-renamed.md', '/tmp/workspace');
    });
    expect(mockFetchFiles).toHaveBeenNthCalledWith(2, '.', '/tmp/workspace');

    promptSpy.mockRestore();
  });
});
