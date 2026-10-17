#!/usr/bin/env python3
"""Testes de tools/painel.py (stdlib unittest).

Rodar:
    python3 -m unittest tools.test_painel -v

Cobre a ressalva do Planejador no PR #8: o campo `testes.tail` de /api/state
deve mostrar apenas o resumo (contagem/passou/falhou) e, nas falhas, o nome do
teste sem stack trace e sem caminhos absolutos (home -> ~, /private/tmp -> <tmp>).
"""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import painel  # noqa: E402

HOME = os.path.expanduser("~")
ROOT = str(painel.ROOT)
TMP = "/private/tmp"


class TestResumoTestes(unittest.TestCase):
    def test_resumo_mostra_contagem_passou_falhou(self):
        saida = "✔ a (1ms)\n✔ b (2ms)\nℹ tests 2\nℹ pass 2\nℹ fail 0\n"
        r = painel.resumo_testes(saida)
        self.assertIn("2 testes", r)
        self.assertIn("2 passou", r)
        self.assertIn("0 falhou", r)
        self.assertNotIn("falhas:", r)

    def test_falha_mostra_nome_sem_caminho_nem_stack(self):
        saida = (
            "✔ passa (1ms)\n"
            "✖ quebra (" + ROOT + "/test/api.test.js:4:3) (2ms)\n"
            "ℹ tests 2\nℹ pass 1\nℹ fail 1\n\n"
            "✖ failing tests:\n\n"
            "test at test/api.test.js:4:1\n"
            "✖ quebra (2ms)\n"
            "  Error: boom\n"
            "      at TestContext.<anonymous> (" + TMP + "/memo-test-x/test/api.test.js:4:44)\n"
            "      at Test.runInAsyncScope (node:async_hooks:228:14)\n"
        )
        r = painel.resumo_testes(saida)
        self.assertIn("falhas:", r)
        self.assertIn("quebra", r)
        self.assertNotIn(HOME, r)
        self.assertNotIn(TMP, r)
        self.assertNotIn("Error: boom", r)
        self.assertNotIn("at TestContext", r)
        self.assertNotIn("node:async_hooks", r)
        # sem duplicar o mesmo teste (aparece 2x na saida do node:test)
        self.assertEqual(r.count("- quebra"), 1)

    def test_home_vira_til_e_private_tmp_vira_tag(self):
        self.assertEqual(painel.sanitiza_caminhos(HOME + "/x/y.js"), "~/x/y.js")
        self.assertEqual(painel.sanitiza_caminhos(TMP + "/a/b.js:1:1"), "<tmp>/a/b.js:1:1")
        self.assertEqual(painel.sanitiza_caminhos(ROOT + "/test/api.test.js"), "~/test/api.test.js")

    def test_sem_resumo_nao_vaza_caminho(self):
        saida = "algum erro inesperado\n" + TMP + "/foo/bar.js: explodiu\n"
        r = painel.resumo_testes(saida)
        self.assertIn("indisponivel", r)
        self.assertIn("<tmp>", r)
        self.assertNotIn(TMP, r)
        self.assertNotIn(HOME, r)

    def test_ansi_removido(self):
        saida = "\x1b[32m✔ a\x1b[0m (1ms)\nℹ tests 1\nℹ pass 1\nℹ fail 0\n"
        r = painel.resumo_testes(saida)
        self.assertNotIn("\x1b", r)

    def test_limita_numero_de_falhas(self):
        linhas = ["✖ t%02d (1ms)" % i for i in range(30)]
        linhas += ["ℹ tests 30", "ℹ pass 0", "ℹ fail 30"]
        r = painel.resumo_testes("\n".join(linhas), limite_falhas=5)
        self.assertEqual(r.count("\n- "), 5)
        self.assertIn("+25", r)

    def test_tap_not_ok(self):
        saida = "not ok 1 - falhou no tap\n1..2\nok 2 - passou\n# tests 2\n# pass 1\n# fail 1\n"
        r = painel.resumo_testes(saida)
        self.assertIn("falhas:", r)
        self.assertIn("falhou no tap", r)


class TestIntegracaoNpmTest(unittest.TestCase):
    def test_tail_real_sem_stack_nem_caminho(self):
        res = painel._run_npm_test()
        self.assertEqual(res["rc"], 0)
        self.assertIsNotNone(res["pass"])
        self.assertIn("passou", res["tail"])
        self.assertNotIn(HOME, res["tail"])
        self.assertNotIn("/Users/", res["tail"])
        self.assertNotIn("/private/", res["tail"])
        self.assertNotIn("    at ", res["tail"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
