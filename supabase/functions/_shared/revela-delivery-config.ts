/** Política efetiva do worker: o banco pausa os avisos e pode substituir o remetente do ambiente. */
export function deliveryConfig(data:unknown,environmentSender:string|undefined){
 const d=(data??{}) as {revealEmailsEnabled?:boolean;senderEmail?:string|null};
 return {enabled:d.revealEmailsEnabled!==false,senderEmail:d.senderEmail?.trim()||environmentSender?.trim()||undefined};
}
