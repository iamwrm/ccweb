import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';

const workspaces = [
  { id: '1', name: 'Session 1', index: 1 },
  { id: '2', name: 'Session 2', index: 2 },
  { id: '3', name: 'Session 3', index: 3 },
];

describe('Sidebar', () => {
  it('renders all workspace items', () => {
    render(
      <Sidebar
        workspaces={workspaces}
        activeId="1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('highlights active workspace', () => {
    render(
      <Sidebar
        workspaces={workspaces}
        activeId="2"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    const items = screen.getAllByRole('button');
    // Find the button containing "2" text
    const activeItem = items.find(el => el.textContent?.includes('2') && el.classList.contains('sidebar-item'));
    expect(activeItem).toHaveClass('active');
  });

  it('calls onSelect when workspace is clicked', () => {
    const onSelect = vi.fn();
    render(
      <Sidebar
        workspaces={workspaces}
        activeId="1"
        onSelect={onSelect}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    // Click workspace 2 (the sidebar-item button with index "2")
    const items = screen.getAllByTitle('Session 2');
    fireEvent.click(items[0]);
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('calls onClose on close button without selecting', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <Sidebar
        workspaces={workspaces}
        activeId="2"
        onSelect={onSelect}
        onClose={onClose}
        onCreate={vi.fn()}
      />
    );

    const closeButtons = screen.getAllByTitle('Close workspace');
    fireEvent.click(closeButtons[0]);

    expect(onClose).toHaveBeenCalledWith('2');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onCreate on + button click', () => {
    const onCreate = vi.fn();
    render(
      <Sidebar
        workspaces={workspaces}
        activeId="1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    fireEvent.click(screen.getByTitle('New workspace'));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
