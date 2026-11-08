import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MoreSheet } from './components';
it('shows reporting failure, preserves retry and prevents duplicate submits while pending',async()=>{
 let reject: (e:Error)=>void=()=>{};
 const onReport=vi.fn(()=>new Promise<void>((_,r)=>{reject=r}));
 render(<MoreSheet onReport={onReport} onClose={()=>{}}/>);
 const button=screen.getByRole('button',{name:'Pedir para remover'});
 fireEvent.click(button);fireEvent.click(button);
 expect(onReport).toHaveBeenCalledTimes(1);
 reject(new Error('network'));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Não deu para enviar'));
 expect(screen.queryByText('Pedido enviado. O anfitrião vai analisar.')).not.toBeInTheDocument();
 onReport.mockResolvedValueOnce();fireEvent.click(screen.getByRole('button',{name:'Pedir para remover'}));
 await screen.findByText('Pedido enviado. O anfitrião vai analisar.');
});
