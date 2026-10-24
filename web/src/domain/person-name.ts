/**
 * Corrige nomes duplicados por concatenação ("Aurimar NogueiraAurimar" vira "Aurimar Nogueira";
 * "Ana SilvaAna Silva" e "Ana Silva Ana Silva" viram "Ana Silva"). Nome sem duplicação volta como está (aparado).
 * Espelha public.clean_person_name, que o banco aplica ao gravar host_name, display_name e o nome do participante.
 */
export function cleanPersonName(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (s.length < 4) return s;
  // Concatenação sem espaço: minúscula seguida de maiúscula, e o resto repete o começo do nome em limite de palavra.
  for (let i = Math.ceil(s.length / 2); i < s.length - 1; i++) {
    const a = s.slice(0, i), rest = s.slice(i);
    if (!/\p{Ll}/u.test(s[i - 1]) || !/\p{Lu}/u.test(s[i])) continue;
    if (a.startsWith(rest) && (a.length === rest.length || a[rest.length] === " ")) return a;
  }
  // Repetição exata separada por espaço, com pelo menos duas palavras ("Ana Silva Ana Silva").
  const w = s.split(" ");
  if (w.length >= 4 && w.length % 2 === 0) {
    const h = w.length / 2;
    if (w.slice(0, h).join(" ") === w.slice(h).join(" ")) return w.slice(0, h).join(" ");
  }
  return s;
}
