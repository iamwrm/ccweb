import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileTree } from '../components/FileTree';

// Mock the api module
vi.mock('../lib/api', () => ({
  fetchFiles: vi.fn(),
}));

import { fetchFiles } from '../lib/api';
const mockFetchFiles = vi.mocked(fetchFiles);

beforeEach(() => {
  mockFetchFiles.mockReset();
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
    expect(onFileSelect).toHaveBeenCalledWith('README.md');
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
});
