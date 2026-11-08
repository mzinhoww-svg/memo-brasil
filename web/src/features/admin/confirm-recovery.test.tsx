import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

it.each([false, true])('mantém Tab (shift=%s) dentro da confirmação durante a espera e restaura o foco ao fechar', async (shift) => {
 const user = userEvent.setup();
 let resolve!: () => void;
 const pending = new Promise<void>((done) => { resolve = done; });
 function Example() {
  const [open, setOpen] = useState(false);
  return <>
   <button onClick={() => setOpen(true)}>Abrir confirmação</button>
   {open && <ConfirmSheet title="Excluir?" onCancel={() => setOpen(false)} onConfirm={() => pending} />}
   <button>Fora da confirmação</button>
  </>;
 }
 render(<Example />);
 const trigger = screen.getByRole('button', { name: 'Abrir confirmação' });
 await user.click(trigger);
 const cancel = screen.getByRole('button', { name: 'Cancelar' });
 const confirm = screen.getByRole('button', { name: 'Remover' });
 const dialog = screen.getByRole('dialog');
 expect(cancel).toHaveFocus();
 await user.click(confirm);
 expect(cancel).toBeDisabled();
 expect(confirm).toBeDisabled();
 expect(dialog).toHaveFocus();

 await user.tab({ shift });
 expect(dialog).toHaveFocus();
 await user.tab({ shift: !shift });
 expect(dialog).toHaveFocus();

 await act(async () => { resolve(); await pending; });
 expect(cancel).toBeEnabled();
 expect(confirm).toBeEnabled();
 await user.tab({ shift });
 expect(shift ? confirm : cancel).toHaveFocus();
 await user.keyboard('{Escape}');
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(trigger).toHaveFocus();
});
