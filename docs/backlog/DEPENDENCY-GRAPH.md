# Grafo de dependências

```mermaid
flowchart LR
  FT_010["FT-010<br/>DONE"]:::done
  TK_010a["TK-010a<br/>BACKLOG"]:::back
  FT_030["FT-030<br/>DONE"]:::done
  US_030a["US-030a<br/>DONE"]:::done
  TK_030a1["TK-030a1<br/>DONE"]:::done
  TK_030a2["TK-030a2<br/>DONE"]:::done
  TK_030a3["TK-030a3<br/>DONE"]:::done
  FT_031["FT-031<br/>DONE"]:::done
  US_031a["US-031a<br/>DONE"]:::done
  TK_031a1["TK-031a1<br/>DONE"]:::done
  TK_031a2["TK-031a2<br/>DONE"]:::done
  FT_032["FT-032<br/>DONE"]:::done
  US_032a["US-032a<br/>DONE"]:::done
  US_032b["US-032b<br/>DONE"]:::done
  FT_033["FT-033<br/>DONE"]:::done
  FT_036["FT-036<br/>DONE"]:::done
  FT_037["FT-037<br/>DONE"]:::done
  BG_071["BG-071<br/>BACKLOG"]:::back
  AUD_001["AUD-001<br/>READY"]:::ready
  REL_002["REL-002<br/>DONE"]:::done
  FT_080["FT-080<br/>DEFERRED"]:::defer
  FT_081["FT-081<br/>DEFERRED"]:::defer
  FT_082["FT-082<br/>DEFERRED"]:::defer
  FT_083["FT-083<br/>DEFERRED"]:::defer
  FT_084["FT-084<br/>DEFERRED"]:::defer
  FT_085["FT-085<br/>DEFERRED"]:::defer
  FT_086["FT-086<br/>DEFERRED"]:::defer
  FT_087["FT-087<br/>DEFERRED"]:::defer
  FT_088["FT-088<br/>DEFERRED"]:::defer
  FT_089["FT-089<br/>DEFERRED"]:::defer
  FT_010 --> TK_010a
  FT_030 --> US_030a
  TK_030a1 --> TK_030a2
  TK_030a1 --> TK_030a3
  FT_030 --> FT_031
  TK_030a3 --> US_031a
  TK_031a1 --> TK_031a2
  FT_030 --> FT_032
  TK_030a1 --> US_032a
  US_032a --> US_032b
  TK_030a3 --> FT_033
  FT_032 --> FT_036
  FT_036 --> FT_037
  AUD_001 --> BG_071
  FT_037 --> AUD_001
  FT_037 --> REL_002
  AUD_001 --> FT_080
  AUD_001 --> FT_081
  AUD_001 --> FT_082
  AUD_001 --> FT_083
  FT_082 --> FT_083
  AUD_001 --> FT_084
  BG_071 --> FT_084
  FT_082 --> FT_084
  AUD_001 --> FT_085
  FT_082 --> FT_085
  AUD_001 --> FT_086
  AUD_001 --> FT_087
  FT_082 --> FT_087
  AUD_001 --> FT_088
  FT_080 --> FT_088
  FT_082 --> FT_088
  AUD_001 --> FT_089
  FT_080 --> FT_089
  FT_082 --> FT_089
  FT_085 --> FT_089
  classDef done fill:#E8ECE4,stroke:#1C1917;
  classDef ready fill:#FFFFFF,stroke:#1C1917,stroke-width:3px;
  classDef test fill:#F4F2EF,stroke:#1C1917;
  classDef block fill:#FFFFFF,stroke:#C41E14,stroke-width:3px;
  classDef defer fill:#F4F2EF,stroke:#6B645F,stroke-dasharray: 4 3;
  classDef back fill:#FFFFFF,stroke:#6B645F;
  classDef prog fill:#F4F2EF,stroke:#1C1917;
```

## Caminho crítico até a integração com o Supabase
1. `FT-037` (revelação validada no preview) → 2. **`AUD-001`** (auditoria independente, P0) → 3. `REL-001` (confirmar/promover destino; não bloqueia o Supabase, bloqueia produção) → 4. `BG-071` (outbox) → 5. `FT-080` Auth e `FT-082` Esquema/RLS → 6. `FT-085` Storage e URLs assinadas → 7. `FT-083` revelação no servidor e `FT-084` realtime → 8. `FT-089` migração local → nuvem.

Tudo em EP-09 está DEFERRED até o release gate passar.
