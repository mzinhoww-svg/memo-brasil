import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ConfirmSheet } from '@/components/memoriesmt/ConfirmSheet';
it('confirmação foca Cancelar e mantém tentativa recuperável em erro', async () => {
 const run = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(undefined);
 render(<ConfirmSheet title="Excluir?" onCancel={() => {}} onConfirm={run} />);
 expect(screen.getByRole('button', {name:'Cancelar'})).toHaveFocus();
 fireEvent.click(screen.getByRole('button', {name:'Remover'}));
 await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Tente de novo/));
 fireEvent.click(screen.getByRole('button', {name:'Remover'}));
 await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
});
