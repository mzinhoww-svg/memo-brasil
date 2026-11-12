export interface PlatformConfig { maxPhotosPerEvent: number|null; maxPhotoBytes: number; senderEmail: string|null; commentsEnabled: boolean; revealEmailsEnabled: boolean }
export type PlatformField = "maxPhotosPerEvent"|"maxPhotoBytes"|"senderEmail";
export const PLATFORM_LABELS: Record<PlatformField,string>={maxPhotosPerEvent:"Teto de fotos por evento",maxPhotoBytes:"Tamanho máximo da foto",senderEmail:"Remetente dos avisos"};
export function platformValue(c:PlatformConfig,key:PlatformField){
 if(key==="maxPhotosPerEvent")return c.maxPhotosPerEvent===null?"Sem teto global":new Intl.NumberFormat("pt-BR").format(c.maxPhotosPerEvent);
 if(key==="maxPhotoBytes")return `${Number((c.maxPhotoBytes/1048576).toFixed(2))} MB`;
 return c.senderEmail??"Não definido no banco";
}
export function platformFieldError(key:PlatformField,value:string):string|null{
 const s=value.trim();
 if(key==="maxPhotosPerEvent")return s===""||/^\d+$/.test(s)&&Number(s)>=1&&Number(s)<=100000?null:"Informe de 1 a 100.000 fotos ou deixe vazio para retirar o teto global.";
 if(key==="maxPhotoBytes")return /^\d+(?:[.,]\d+)?$/.test(s)&&Number(s.replace(",","."))>0&&Number(s.replace(",","."))<=8?null:"Informe um tamanho maior que zero, até 8 MB.";
 return s===""||s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?null:"E-mail inválido.";
}
export function platformFieldValue(key:PlatformField,value:string):number|string|null{
 const s=value.trim();
 return key==="senderEmail"?s.toLowerCase()||null:key==="maxPhotoBytes"?Math.max(1,Math.round(Number(s.replace(",","."))*1048576)):s===""?null:Number(s);
}
export function platformChanges(a:PlatformConfig,b:PlatformConfig):Partial<PlatformConfig>{
 return Object.fromEntries((Object.keys(a) as (keyof PlatformConfig)[]).filter(k=>a[k]!==b[k]).map(k=>[k,b[k]]));
}
