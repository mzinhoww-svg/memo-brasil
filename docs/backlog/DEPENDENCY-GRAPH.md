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
  BG_040["BG-040<br/>BACKLOG"]:::back
  BG_071["BG-071<br/>BACKLOG"]:::back
  AUD_001["AUD-001<br/>DONE"]:::done
  REL_001["REL-001<br/>BLOCKED"]:::block
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
  INF_001["INF-001<br/>READY"]:::ready
  BG_101["BG-101<br/>DONE"]:::done
  BG_102["BG-102<br/>DONE"]:::done
  BG_111["BG-111<br/>BACKLOG"]:::back
  BG_113["BG-113<br/>DONE"]:::done
  ITG_101["ITG-101<br/>DONE"]:::done
  ITG_102["ITG-102<br/>DONE"]:::done
  ITG_103["ITG-103<br/>DONE"]:::done
  ITG_104["ITG-104<br/>DONE"]:::done
  ITG_105["ITG-105<br/>DONE"]:::done
  ITG_106["ITG-106<br/>DONE"]:::done
  ITG_107["ITG-107<br/>BACKLOG"]:::back
  ITG_108["ITG-108<br/>BACKLOG"]:::back
  ITG_109["ITG-109<br/>BACKLOG"]:::back
  ITG_110["ITG-110<br/>BACKLOG"]:::back
  INF_002["INF-002<br/>BLOCKED"]:::block
  AUD_002["AUD-002<br/>DONE"]:::done
  SB_001["SB-001<br/>DONE"]:::done
  SB_002["SB-002<br/>DONE"]:::done
  SB_003["SB-003<br/>DONE"]:::done
  SB_004["SB-004<br/>BLOCKED"]:::block
  SB_005["SB-005<br/>BACKLOG"]:::back
  SB_006["SB-006<br/>BACKLOG"]:::back
  SB_007["SB-007<br/>BACKLOG"]:::back
  SB_008["SB-008<br/>BLOCKED"]:::block
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
  ITG_102 --> BG_071
  FT_037 --> AUD_001
  FT_037 --> REL_002
  INF_001 --> FT_080
  AUD_002 --> FT_080
  ITG_105 --> FT_080
  AUD_002 --> FT_081
  INF_001 --> FT_082
  AUD_002 --> FT_082
  ITG_104 --> FT_082
  ITG_109 --> FT_082
  ITG_106 --> FT_082
  FT_082 --> FT_083
  INF_001 --> FT_083
  AUD_002 --> FT_083
  ITG_104 --> FT_083
  BG_071 --> FT_084
  FT_082 --> FT_084
  INF_001 --> FT_084
  AUD_002 --> FT_084
  ITG_102 --> FT_084
  FT_082 --> FT_085
  INF_001 --> FT_085
  AUD_002 --> FT_085
  ITG_103 --> FT_085
  AUD_002 --> FT_086
  FT_082 --> FT_087
  INF_001 --> FT_087
  AUD_002 --> FT_087
  ITG_101 --> FT_087
  FT_080 --> FT_088
  FT_082 --> FT_088
  INF_001 --> FT_088
  AUD_002 --> FT_088
  ITG_109 --> FT_088
  FT_080 --> FT_089
  FT_082 --> FT_089
  FT_085 --> FT_089
  INF_001 --> FT_089
  AUD_002 --> FT_089
  ITG_105 --> FT_089
  BG_101 --> BG_102
  BG_040 --> BG_111
  BG_101 --> ITG_101
  BG_102 --> ITG_101
  ITG_106 --> ITG_101
  ITG_106 --> ITG_102
  BG_113 --> ITG_102
  ITG_102 --> ITG_103
  BG_101 --> ITG_104
  BG_102 --> ITG_104
  ITG_106 --> ITG_104
  ITG_102 --> ITG_105
  ITG_106 --> ITG_107
  ITG_106 --> ITG_108
  ITG_106 --> ITG_109
  ITG_102 --> ITG_110
  REL_001 --> INF_002
  BG_101 --> AUD_002
  ITG_101 --> AUD_002
  ITG_102 --> AUD_002
  ITG_103 --> AUD_002
  ITG_104 --> AUD_002
  ITG_105 --> AUD_002
  ITG_106 --> AUD_002
  ITG_106 --> SB_001
  SB_001 --> SB_002
  ITG_102 --> SB_002
  SB_001 --> SB_003
  SB_003 --> SB_004
  SB_003 --> SB_005
  SB_002 --> SB_006
  SB_003 --> SB_007
  SB_003 --> SB_008
  SB_004 --> SB_008
  REL_001 --> SB_008
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
