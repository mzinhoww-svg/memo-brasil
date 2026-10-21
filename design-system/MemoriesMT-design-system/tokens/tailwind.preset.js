// MemoriesMT · preset Tailwind (v3). Importe tokens/tokens.css no CSS global.
// Uso: module.exports = { presets: [require('./tailwind.preset.js')], content: [...] }
module.exports = {
  theme: {
    extend: {
      colors: {
        'fundo': 'var(--fundo)',
        'neutro': 'var(--neutro)',
        'tinta': 'var(--tinta)',
        'apoio': 'var(--apoio)',
        'borda': 'var(--borda)',
        'divisor': 'var(--divisor)',
        'acao': 'var(--acao)',
        'on-acao': 'var(--on-acao)',
        'foco': 'var(--foco)',
        'rec': 'var(--rec)',
        'rec-texto': 'var(--rec-texto)',
        'on-rec': 'var(--on-rec)',
        'desabilitado': 'var(--desabilitado)',
        'on-desabilitado': 'var(--on-desabilitado)',
        'evento-superficie': 'var(--evento-superficie)',
        'evento-grafismo': 'var(--evento-grafismo)',
        'evento-controle': 'var(--evento-controle)',
        'evento-texto': 'var(--evento-texto)',
        'evento-profundo': 'var(--evento-profundo)',
        'on-evento': 'var(--on-evento)'
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '9': 'var(--space-9)',
        '10': 'var(--space-10)'
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'control': 'var(--radius-control)',
        'panel': 'var(--radius-panel)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        'icone': 'var(--radius-icone)',
        'pill': 'var(--radius-pill)'
      },
      height: {
        'avatar': 'var(--size-avatar)',
        'alvo': 'var(--size-alvo)',
        'opcao': 'var(--size-opcao)',
        'nav': 'var(--size-nav)',
        'campo': 'var(--size-campo)',
        'cta': 'var(--size-cta)',
        'cta-xl': 'var(--size-cta-xl)'
      },
      minHeight: {
        'avatar': 'var(--size-avatar)',
        'alvo': 'var(--size-alvo)',
        'opcao': 'var(--size-opcao)',
        'nav': 'var(--size-nav)',
        'campo': 'var(--size-campo)',
        'cta': 'var(--size-cta)',
        'cta-xl': 'var(--size-cta-xl)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        evento: ['var(--font-evento)']
      }
    }
  }
};
