import { masterAccess } from "@/lib/master/server";
import { isMissingRpc } from "@/features/master/params";
import { EMPTY_RESULTS, SEARCH_LIMIT, SEARCH_MAX, SEARCH_MIN, eventsFromList, normalizeSearch, type SearchResults } from "../shell/search";

/**
 * Busca global do console (⌘K). Route Handlers não passam pelo layout: o acesso master é reconferido aqui
 * e a autorização final é do banco (`admin_search` checa o papel e mascara e-mail para quem não é master).
 */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const { access, sb } = await masterAccess();
  if (access !== "ok" || !sb) return json({ error: "forbidden" }, 403);

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, SEARCH_MAX);
  if (q.length < SEARCH_MIN) return json(EMPTY_RESULTS satisfies SearchResults);

  const res = await sb.rpc("admin_search", { p_q: q });
  if (!res.error) return json(normalizeSearch(res.data) satisfies SearchResults);
  if (!isMissingRpc(res.error, "admin_search")) {
    const denied = res.error.code === "MM004" || /forbidden/i.test(res.error.message);
    return json({ error: denied ? "forbidden" : "error" }, denied ? 403 : 500);
  }

  // Migration ainda não aplicada: só eventos, pela RPC antiga.
  console.warn("[master] RPC admin_search inexistente no banco; usando admin_list_events (modo degradado)");
  const old = await sb.rpc("admin_list_events", { p_limit: SEARCH_LIMIT, p_search: q });
  if (old.error) return json({ error: "error" }, 500);
  return json({ events: eventsFromList(old.data), users: [], orders: [], degraded: true } satisfies SearchResults);
}
