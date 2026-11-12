import {describe,expect,it} from "vitest";
import {deliveryConfig} from "./revela-delivery-config";
describe("política efetiva do worker de avisos",()=>{
 it("respeita pausa antes de reivindicar ou enviar e o remetente configurado",()=>{
  expect(deliveryConfig({revealEmailsEnabled:false,senderEmail:"db@teste.local"},"env@teste.local")).toEqual({enabled:false,senderEmail:"db@teste.local"});
 });
 it("ausência de chave mantém ambiente e comportamento anterior sem inventar remetente",()=>{
  expect(deliveryConfig({senderEmail:null},"env@teste.local")).toEqual({enabled:true,senderEmail:"env@teste.local"});
  expect(deliveryConfig(null,undefined)).toEqual({enabled:true,senderEmail:undefined});
 });
});
