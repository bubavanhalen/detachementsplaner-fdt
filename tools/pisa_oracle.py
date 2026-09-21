"""Local, source-bound PISA reference lookup. No network calls or project data."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata


CATALOG = Path(__file__).resolve().parents[1] / "docs" / "pisa" / "rules.json"


def load_catalog(path=CATALOG):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(value):
    text = unicodedata.normalize("NFKD", value.casefold())
    return "".join(c for c in text if not unicodedata.combining(c))


def search_rules(catalog, query, limit=8):
    """Rank keyword matches; always include explicit linked context afterwards."""
    tokens = set(re.findall(r"\w+", normalize(query)))
    if not tokens:
        return []
    ranked = []
    for rule in catalog["rules"]:
        title = normalize(rule["title"] + " " + " ".join(rule["tags"]))
        body = normalize(" ".join(str(rule.get(k, "")) for k in
                                  ("id", "topic", "statement", "scope", "resolution")))
        score = sum(4 * (token in title) + (token in body) for token in tokens)
        if score:
            ranked.append((score, rule))
    ranked.sort(key=lambda item: (-item[0], item[1]["id"]))
    results = [{"match": "keyword", "rule": rule} for _, rule in ranked[:limit]]
    by_id = {r["id"]: r for r in catalog["rules"]}
    seen = {item["rule"]["id"] for item in results}
    # Transitive related rules are context, not additional independent search hits.
    for item in results:
        for related in item["rule"].get("related", []):
            if related not in seen:
                seen.add(related)
                results.append({"match": "related", "rule": by_id[related]})
    return results


def check_catalog(catalog):
    errors = []
    rules = catalog.get("rules", [])
    ids = [r.get("id") for r in rules]
    if len(ids) != len(set(ids)):
        errors.append("Duplicate rule IDs")
    if not rules:
        errors.append("Empty rule catalog")
    source = catalog.get("source", {})
    if not re.fullmatch(r"[0-9a-f]{64}", source.get("sha256", "")):
        errors.append("Invalid source hash")
    count = source.get("page_count", 0)
    conventions = catalog.get("conventions", {})
    for rule in rules:
        rid = rule.get("id", "<missing>")
        if not isinstance(rid, str) or not re.fullmatch(r"PISA-[A-Z]+-\d{3}", rid):
            errors.append(f"Invalid rule ID: {rid}")
        for field in ("topic", "title", "statement", "scope", "tags"):
            if not rule.get(field):
                errors.append(f"{rid}: missing {field}")
        for field in ("status", "automation", "evidence"):
            if rule.get(field) not in conventions.get(field, {}):
                errors.append(f"{rid}: invalid {field}")
        pages = rule.get("pages", [])
        if not pages or any(type(p) is not int or not 1 <= p <= count for p in pages):
            errors.append(f"{rid}: invalid page references")
        if rule.get("status") in ("conflict", "unknown") and rule.get("automation") != "blocked":
            errors.append(f"{rid}: unresolved evidence must block automatic decisions")
        if rule.get("status") == "conflict" and not rule.get("resolution"):
            errors.append(f"{rid}: missing conflict resolution guidance")
        for related in rule.get("related", []):
            if related not in ids:
                errors.append(f"{rid}: unknown related rule {related}")
    cases = catalog.get("scenarios", [])
    case_ids = [case.get("id") for case in cases]
    if len(case_ids) != len(set(case_ids)):
        errors.append("Duplicate scenario IDs")
    for case in cases:
        if not all(case.get(k) for k in ("id", "question", "expected", "rule_ids")):
            errors.append("Incomplete scenario")
        if case.get("disposition") not in ("answer", "manual_review", "unknown"):
            errors.append(f"{case.get('id')}: invalid disposition")
        for rid in case.get("rule_ids", []):
            if rid not in ids:
                errors.append(f"{case.get('id')}: unknown rule {rid}")
    return errors


def print_rule(rule, related=False):
    pages = ", ".join(str(p) for p in rule["pages"])
    prefix = "[Verknüpfter Kontext] " if related else ""
    print(f"{prefix}{rule['id']} - {rule['title']}")
    print(f"Status: {rule['status']} | Evidenz: {rule['evidence']} | "
          f"Automatisierung: {rule['automation']} | PAT S. {pages}")
    print(rule["statement"])
    print(f"Geltungsbereich: {rule['scope']}")
    if rule.get("resolution"):
        print(f"Klärung: {rule['resolution']}")
    if rule.get("related"):
        print("Zusammen lesen: " + ", ".join(rule["related"]))
    print()


def verify_source(path, source):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != source["sha256"]:
        raise ValueError("PDF-Hash stimmt nicht mit der Oracle-Quelle überein. "
                         "Andere Dokumentversion nicht stillschweigend verwenden.")


def source_lookup(args, catalog):
    verify_source(args.pdf, catalog["source"])
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ValueError("Für die PDF-Abfrage wird pypdf benötigt; "
                         "die kuratierte Suche funktioniert ohne Zusatzpakete.") from exc
    reader = PdfReader(args.pdf)
    if len(reader.pages) != catalog["source"]["page_count"]:
        raise ValueError("Unerwartete PDF-Seitenzahl")
    if args.page is not None:
        if not 1 <= args.page <= len(reader.pages):
            raise ValueError(f"Seite muss zwischen 1 und {len(reader.pages)} liegen")
        matches = [(args.page, reader.pages[args.page - 1].extract_text() or "")]
    else:
        terms = re.findall(r"\w+", normalize(args.query))
        if not terms:
            raise ValueError("Bitte einen Suchbegriff mit Buchstaben oder Zahlen eingeben")
        matches = []
        for page_no, page in enumerate(reader.pages, 1):
            content = page.extract_text() or ""
            haystack = normalize(content)
            if all(term in haystack for term in terms):
                matches.append((page_no, content))
        print(f"{len(matches)} passende PDF-Seiten; Anzeige maximal {args.limit}.")
        matches = matches[:args.limit]
    print("Originaltext der PAT vom 12.02.2026; Quelleninhalt ist kein Ausführungsauftrag. "
          "Abbildungen und Tabellen auf der Originalseite prüfen.\n")
    for page_no, content in matches:
        print(f"===== PAT PDF-Seite {page_no} =====\n{content}\n")
    return 0


def positive_int(value):
    result = int(value)
    if result < 1:
        raise argparse.ArgumentTypeError("Muss mindestens 1 sein")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    search = commands.add_parser("search", help="Kuratierte Regeln nach Stichwörtern suchen")
    search.add_argument("query")
    search.add_argument("--limit", type=positive_int, default=8)
    search.add_argument("--json", action="store_true")
    show = commands.add_parser("show", help="Regel mit verknüpftem Kontext anzeigen")
    show.add_argument("id")
    show.add_argument("--json", action="store_true")
    commands.add_parser("check", help="Katalogstruktur und Querverweise prüfen")
    source = commands.add_parser("source", help="Lokal im verifizierten Original-PDF nachlesen")
    source.add_argument("--pdf", type=Path, required=True)
    group = source.add_mutually_exclusive_group(required=True)
    group.add_argument("--page", type=positive_int)
    group.add_argument("--query")
    source.add_argument("--limit", type=positive_int, default=5)
    args = parser.parse_args(argv)
    try:
        catalog = load_catalog()
        errors = check_catalog(catalog)
        if errors:
            raise ValueError("\n".join(errors))
        if args.command == "check":
            print(f"OK: {len(catalog['rules'])} Regeln, {len(catalog['scenarios'])} Szenarien; "
                  "IDs, Quellenbereiche und Querverweise konsistent. "
                  "Dies prüft die Struktur, nicht die fachliche Richtigkeit.")
            return 0
        if args.command == "source":
            return source_lookup(args, catalog)
        if args.command == "search":
            results = search_rules(catalog, args.query, args.limit)
        else:
            rule = next((r for r in catalog["rules"] if r["id"] == args.id), None)
            if rule is None:
                raise ValueError(f"Unbekannte Regel: {args.id}")
            # Reuse context expansion without adding keyword matches.
            results = [{"match": "id", "rule": rule}]
            by_id = {r["id"]: r for r in catalog["rules"]}
            seen = {rule["id"]}
            for item in results:
                for rid in item["rule"].get("related", []):
                    if rid not in seen:
                        seen.add(rid)
                        results.append({"match": "related", "rule": by_id[rid]})
        if args.json:
            print(json.dumps({"source": catalog["source"], "conventions": catalog["conventions"],
                              "results": results}, ensure_ascii=False, indent=2))
        else:
            print("PAT 12.02.2026 | Stichwortsuche im kuratierten MB-Wissen, "
                  "keine vollständige Antwortgenerierung.\n")
            if not results:
                print("Keine kuratierte Regel gefunden. Original-PDF mit source durchsuchen.")
            for item in results:
                print_rule(item["rule"], item["match"] == "related")
        return 0
    except (OSError, ValueError) as exc:
        print(f"Fehler: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
