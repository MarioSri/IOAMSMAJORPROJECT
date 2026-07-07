
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button', () => {
    it('renders correctly', () => {
        // Basic test to verify testing setup
        const { container } = render(<button>Click me</button>);
        expect(screen.getByText('Click me')).toBeInTheDocument();
    });
});
