"""Retrieval must retain provenance, conflicts and source identity."""

from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    "pisa_oracle", Path(__file__).resolve().parents[1] / "tools" / "pisa_oracle.py")
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)


class OracleTests(unittest.TestCase):
    def setUp(self):
        self.catalog = oracle.load_catalog()

    def test_catalog_references_are_consistent(self):
        self.assertEqual(oracle.check_catalog(self.catalog), [])

    def test_ec_lookup_keeps_conflicting_source_and_namespace_unknown(self):
        out = io.StringIO()
        with redirect_stdout(out):
            code = oracle.main(["show", "PISA-EC-001", "--json"])
        self.assertEqual(code, 0)
        payload = json.loads(out.getvalue())
        rules = {item["rule"]["id"]: item["rule"] for item in payload["results"]}
        self.assertEqual(rules["PISA-CONFLICT-002"]["status"], "conflict")
        self.assertEqual(rules["PISA-UNKNOWN-002"]["status"], "unknown")
        self.assertEqual(rules["PISA-EC-001"]["pages"], [85])
        self.assertEqual(payload["source"]["document_date"], "2026-02-12")

    def test_limited_search_still_returns_linked_conflicts(self):
        results = oracle.search_rules(self.catalog, "Wochenende zwischen zwei Ausbildungsdiensten", 1)
        ids = {item["rule"]["id"] for item in results}
        self.assertIn("PISA-DAYS-002", ids)
        self.assertIn("PISA-CONFLICT-001", ids)

    def test_unknown_query_does_not_invent_answer(self):
        self.assertEqual(oracle.search_rules(self.catalog, "xylophonquantenimport"), [])

    def test_unresolved_conflict_cannot_be_marked_automatable(self):
        catalog = deepcopy(self.catalog)
        rule = next(r for r in catalog["rules"] if r["status"] == "conflict")
        rule["automation"] = "candidate"
        self.assertTrue(any("must block" in e for e in oracle.check_catalog(catalog)))

    def test_dangling_source_and_rule_reference_are_rejected(self):
        catalog = deepcopy(self.catalog)
        catalog["rules"][0]["pages"] = [181]
        catalog["scenarios"][0]["rule_ids"] = ["PISA-MISSING-999"]
        errors = oracle.check_catalog(catalog)
        self.assertTrue(any("page references" in e for e in errors))
        self.assertTrue(any("unknown rule" in e for e in errors))

    def test_different_source_file_is_rejected_before_extraction(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "another-version.pdf"
            path.write_bytes(b"Not the approved source")
            with self.assertRaisesRegex(ValueError, "Hash"):
                oracle.verify_source(path, self.catalog["source"])

    def test_unknown_rule_is_an_explicit_error(self):
        err = io.StringIO()
        with redirect_stderr(err):
            self.assertEqual(oracle.main(["show", "PISA-MISSING-999"]), 2)
        self.assertIn("Unbekannte Regel", err.getvalue())


if __name__ == "__main__":
    unittest.main()
