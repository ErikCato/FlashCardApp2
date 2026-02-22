from pathlib import Path
import json
import re
import sys


ID_PATTERN = re.compile(r"^[a-z0-9-]+$")


def is_non_empty_string(value):
    return isinstance(value, str) and value.strip() != ""


def validate_bundle(data):
    errors = []

    if not isinstance(data, dict):
        return ["$: must be a JSON object"]

    if data.get("schemaVersion") != 1:
        errors.append("schemaVersion: must equal 1")

    generated_at = data.get("generatedAt")
    if not is_non_empty_string(generated_at):
        errors.append("generatedAt: must be a non-empty string")

    decks = data.get("decks")
    if not isinstance(decks, list) or len(decks) == 0:
        errors.append("decks: must be a non-empty list")
        return errors

    seen_deck_ids = set()

    for di, deck_entry in enumerate(decks):
        dpath = f"decks[{di}]"

        if not isinstance(deck_entry, dict):
            errors.append(f"{dpath}: must be an object")
            continue

        deck_obj = deck_entry.get("deck")
        if not isinstance(deck_obj, dict):
            errors.append(f"{dpath}.deck: must be an object with id and name")
            continue

        deck_id = deck_obj.get("id")
        deck_name = deck_obj.get("name")

        if not is_non_empty_string(deck_id):
            errors.append(f"{dpath}.deck.id: must be a non-empty string")
        elif not ID_PATTERN.match(deck_id):
            errors.append(f"{dpath}.deck.id: must match ^[a-z0-9-]+$")
        elif deck_id in seen_deck_ids:
            errors.append(f"{dpath}.deck.id: duplicate id '{deck_id}'")
        else:
            seen_deck_ids.add(deck_id)

        if not is_non_empty_string(deck_name):
            errors.append(f"{dpath}.deck.name: must be a non-empty string")

        areas = deck_entry.get("areas")
        if not isinstance(areas, list) or len(areas) == 0:
            errors.append(f"{dpath}.areas: must be a non-empty list")
            continue

        seen_area_ids = set()

        for ai, area_entry in enumerate(areas):
            apath = f"{dpath}.areas[{ai}]"

            if not isinstance(area_entry, dict):
                errors.append(f"{apath}: must be an object")
                continue

            area_id = area_entry.get("id")
            area_name = area_entry.get("name")

            if not is_non_empty_string(area_id):
                errors.append(f"{apath}.id: must be a non-empty string")
            elif not ID_PATTERN.match(area_id):
                errors.append(f"{apath}.id: must match ^[a-z0-9-]+$")
            elif area_id in seen_area_ids:
                errors.append(f"{apath}.id: duplicate id '{area_id}' within deck")
            else:
                seen_area_ids.add(area_id)

            if not is_non_empty_string(area_name):
                errors.append(f"{apath}.name: must be a non-empty string")

            cards = area_entry.get("cards")
            if not isinstance(cards, list) or len(cards) == 0:
                errors.append(f"{apath}.cards: must be a non-empty list")
                continue

            seen_questions = set()

            for ci, card in enumerate(cards):
                cpath = f"{apath}.cards[{ci}]"

                if not isinstance(card, dict):
                    errors.append(f"{cpath}: must be an object with q and a")
                    continue

                q = card.get("q")
                a = card.get("a")

                if not isinstance(q, str):
                    errors.append(f"{cpath}.q: must be a string")
                elif q.strip() == "":
                    errors.append(f"{cpath}.q: must be non-empty")

                if not isinstance(a, str):
                    errors.append(f"{cpath}.a: must be a string")
                elif a.strip() == "":
                    errors.append(f"{cpath}.a: must be non-empty")

                if isinstance(q, str) and q.strip() != "":
                    q_norm = q.strip()
                    if q_norm in seen_questions:
                        errors.append(f"{cpath}.q: duplicate question '{q_norm}' within area")
                    else:
                        seen_questions.add(q_norm)

    return errors


def main():
    bundle_files = sorted(Path("docs/bundles").glob("*.json"))

    if not bundle_files:
        print("FAIL: docs/bundles/*.json")
        print("  - no bundle files found")
        return 1

    failed = False

    for file_path in bundle_files:
        file_errors = []

        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception as exc:
            file_errors.append(f"$: cannot read file ({exc})")
            content = None

        data = None
        if content is not None:
            try:
                data = json.loads(content)
            except json.JSONDecodeError as exc:
                file_errors.append(f"$: invalid JSON at line {exc.lineno}, col {exc.colno}: {exc.msg}")

        if data is not None:
            file_errors.extend(validate_bundle(data))

        rel_name = file_path.as_posix()
        if file_errors:
            failed = True
            print(f"FAIL: {rel_name}")
            for err in file_errors:
                print(f"  - {err}")
        else:
            print(f"OK: {rel_name}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
