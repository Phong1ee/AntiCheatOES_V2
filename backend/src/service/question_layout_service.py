"""Canonical deterministic layout for attempt creation and teacher previews.

Positions are one-based answer slots; page gaps are explicit when keeping a
block together. Pins are validated after pagination, never silently displaced.
"""
import hashlib
import random


def build_layout(question_ids, members=None, blocks=None, questions_per_page=1, shuffle=False, seed="0"):
    if not 1 <= questions_per_page <= 50:
        raise ValueError("questions_per_page must be between 1 and 50")
    ids = list(question_ids)
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate question in layout")
    members = members or {}
    blocks = blocks or {}
    rng = random.Random(int.from_bytes(hashlib.sha256(str(seed).encode()).digest(), "big"))
    logical, seen = [], set()
    for qid in ids:
        member = members.get(qid, {})
        bid = member.get("block_id")
        key = ("block", bid) if bid is not None else ("question", qid)
        if key in seen:
            continue
        seen.add(key)
        block = dict(blocks.get(bid, {})) if bid is not None else {}
        children = [q for q in ids if members.get(q, {}).get("block_id") == bid] if bid is not None else [qid]
        children.sort(key=lambda q: (members.get(q, {}).get("structure_order", 0), q))
        if bid is not None and any(members.get(q, {}).get("pinned_position") is not None for q in children):
            raise ValueError("Pin the logical block instead of a child within it")
        if shuffle and bid is not None and not block.get("keep_order", True):
            rng.shuffle(children)
        logical.append({"children": children, "block": block if bid is not None else None,
                        "pin": block.get("pinned_position") if bid is not None else member.get("pinned_position"),
                        "order": block.get("structure_order", 0) if bid is not None else member.get("structure_order", 0)})
    logical.sort(key=lambda b: (b["order"], ids.index(b["children"][0])))
    pinned = [b for b in logical if b["pin"] is not None]
    free = [b for b in logical if b["pin"] is None]
    if shuffle:
        rng.shuffle(free)
    occupied = {}

    def fits(block, start):
        length = len(block["children"])
        if block["block"] and block["block"].get("keep_together", True) and length <= questions_per_page:
            if (start % questions_per_page) + length > questions_per_page:
                return False
        return all(i not in occupied for i in range(start, start + length))

    def place(block, start):
        for i, qid in enumerate(block["children"]):
            occupied[start + i] = (qid, block)

    capacity = len(ids) + len(logical) * (questions_per_page - 1)
    for block in sorted(pinned, key=lambda b: b["pin"]):
        start = block["pin"] - 1
        if start < 0 or start + len(block["children"]) > max(capacity, 1) or not fits(block, start):
            raise ValueError("Pinned position conflicts with another block or page boundary")
        place(block, start)
    for block in free:
        start = 0
        while not fits(block, start):
            start += 1
            if start > capacity:
                raise ValueError("No legal layout slots remain")
        place(block, start)
    # Don't create inaccessible empty pages from a pin with no preceding content.
    used_pages = {i // questions_per_page for i in occupied}
    if used_pages and used_pages != set(range(max(used_pages) + 1)):
        raise ValueError("Pinned position creates an empty page")
    result = []
    for order, (position, (qid, block)) in enumerate(sorted(occupied.items()), 1):
        page = position // questions_per_page + 1
        first = block["children"][0]
        first_position = next(i for i, (q, _) in occupied.items() if q == first)
        result.append({"question_id": qid, "display_order": order, "position": position + 1,
                       "page": page, "slot": position % questions_per_page + 1,
                       "questions_per_page": questions_per_page, "block": block["block"],
                       "continuation": page > first_position // questions_per_page + 1})
    return result
